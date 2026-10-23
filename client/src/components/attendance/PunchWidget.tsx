import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, CheckCircle2, LogIn, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/lib/api';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons (Vite/webpack issue)
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface TodayAttendance {
  id?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  workingHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  checkInLocation?: { latitude: number; longitude: number; address?: string };
  checkOutLocation?: { latitude: number; longitude: number; address?: string };
}

interface PunchWidgetProps {
  compact?: boolean;
  variant?: 'default' | 'header';
}

export function PunchWidget({ compact = false, variant = 'default' }: PunchWidgetProps) {
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchToday();
  }, []);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today');
      setToday(res.data.data);
    } catch {
      setToday(null);
    } finally {
      setLoading(false);
    }
  };

  const getLocation = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    );

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  const openPunchMap = async (type: 'in' | 'out') => {
    setPunchType(type);
    setLocating(true);
    setMapOpen(true);

    try {
      const pos = await getLocation();
      const { latitude: lat, longitude: lng } = pos.coords;
      const address = await reverseGeocode(lat, lng);
      setLocation({ lat, lng, address });
    } catch (err: any) {
      toast.error('Could not get location. Please enable GPS.');
      setMapOpen(false);
    } finally {
      setLocating(false);
    }
  };

  // Init Leaflet map when dialog opens and location is ready
  useEffect(() => {
    if (!mapOpen || !location || !mapRef.current) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      // Destroy existing map
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }

      const map = L.map(mapRef.current).setView([location.lat, location.lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // User marker (blue)
      const userIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });

      markerRef.current = L.marker([location.lat, location.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>Your Location</b><br/>${location.address}`)
        .openPopup();

      // Accuracy circle
      L.circle([location.lat, location.lng], {
        radius: 30,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);

      leafletMap.current = map;
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [mapOpen, location]);

  const [isWFH, setIsWFH] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);

  // Cleanup map on close
  useEffect(() => {
    if (!mapOpen && leafletMap.current) {
      leafletMap.current.remove();
      leafletMap.current = null;
    }
  }, [mapOpen]);

  const handlePunch = async () => {
    if (!location) return;
    setPunching(true);
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      const res = await api.post(endpoint, {
        latitude: location.lat,
        longitude: location.lng,
        address: location.address,
        isWFH,
        isHalfDay,
      });
      toast.success(res.data.message || (punchType === 'in' ? 'Punched in!' : 'Punched out!'));
      setMapOpen(false);
      fetchToday();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Punch failed');
    } finally {
      setPunching(false);
    }
  };

  const hasPunchedIn = !!today?.checkIn;
  const hasPunchedOut = !!today?.checkOut;

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const workingDuration = () => {
    if (!today?.checkIn) return null;
    const start = new Date(today.checkIn).getTime();
    const end = today.checkOut ? new Date(today.checkOut).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const renderMapDialog = () => (
    <Dialog open={mapOpen} onOpenChange={(o) => { if (!punching) setMapOpen(o); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            {punchType === 'in' ? 'Punch In' : 'Punch Out'} — Confirm Location
          </DialogTitle>
        </DialogHeader>

        {locating ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Getting your location...</p>
          </div>
        ) : location ? (
          <>
            {/* Leaflet Map */}
            <div ref={mapRef} className="w-full h-64" style={{ zIndex: 0 }} />

            {/* Location info */}
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Your Location</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{location.address}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>
                  {punchType === 'in' ? 'Check-in' : 'Check-out'} time:{' '}
                  <span className="font-bold text-foreground">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </div>

              {punchType === 'in' && (
                <div className="flex gap-4 my-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" checked={isWFH} onChange={(e) => setIsWFH(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                    Work From Home (location check waived)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                    Half Day
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setMapOpen(false)} disabled={punching}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handlePunch} disabled={punching}>
                  {punching ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm {punchType === 'in' ? 'Punch In' : 'Punch Out'}</>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3 p-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-center text-muted-foreground">
              Location access denied. Please enable GPS in your browser settings.
            </p>
            <Button variant="outline" onClick={() => setMapOpen(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (loading && variant === 'header') {
    return (
      <div className="flex items-center justify-center h-10 w-32 bg-muted/30 rounded-full">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <Card className={compact ? 'border-none shadow-none' : ''}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (variant === 'header') {
    return (
      <>
        <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm rounded-full px-3 py-2 shrink-0 h-14 ml-2">
          <div className="flex flex-col items-center justify-center px-2 sm:px-3 min-w-[70px] sm:min-w-[90px]">
            <span className="flex items-center gap-1.5 text-sm font-bold tracking-tight tabular-nums leading-none mb-1 text-slate-800">
              <Clock className="w-4 h-4 text-primary" />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase leading-none hidden sm:block">
              {hasPunchedIn ? (hasPunchedOut ? 'Punched Out' : 'Punched In') : 'Not Punched'}
            </span>
          </div>
          <div className="flex gap-2 border-l pl-3 border-slate-100">
            <Button
              size="default"
              className={`h-10 px-4 sm:px-6 text-sm rounded-full font-bold ${hasPunchedIn ? 'bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}`}
              disabled={hasPunchedIn}
              onClick={() => openPunchMap('in')}
              variant="ghost"
            >
              <LogIn className="w-4 h-4 mr-1 sm:mr-2" />
              <span>In</span>
            </Button>
            <Button
              size="default"
              className={`h-10 px-4 sm:px-6 text-sm rounded-full font-bold ${(!hasPunchedIn || hasPunchedOut) ? 'bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'}`}
              disabled={!hasPunchedIn || hasPunchedOut}
              onClick={() => openPunchMap('out')}
              variant="ghost"
            >
              <LogOut className="w-4 h-4 mr-1 sm:mr-2" />
              <span>Out</span>
            </Button>
          </div>
        </div>
        {renderMapDialog()}
      </>
    );
  }

  return (
    <>
      <Card className={`overflow-hidden ${compact ? 'border-none shadow-none bg-transparent' : 'border-none shadow-xl bg-card/60 backdrop-blur-xl'}`}>
        {!compact && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-primary" />
              Attendance
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? 'p-0' : 'pt-0'}>
          {/* Live Clock */}
          <div className="text-center mb-4">
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Check In</p>
              <p className="text-lg font-bold">{formatTime(today?.checkIn)}</p>
              {today?.isLate && (
                <Badge className="text-[9px] bg-warning/10 text-warning mt-1">
                  +{today.lateMinutes}m late
                </Badge>
              )}
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Check Out</p>
              <p className="text-lg font-bold">{formatTime(today?.checkOut)}</p>
              {workingDuration() && (
                <p className="text-[10px] text-muted-foreground mt-1">{workingDuration()}</p>
              )}
            </div>
          </div>

          {/* Status badge */}
          {today?.status && (
            <div className="flex justify-center mb-4">
              <Badge className={
                today.status === 'present' ? 'bg-success/10 text-success' :
                today.status === 'late' ? 'bg-warning/10 text-warning' :
                'bg-muted text-muted-foreground'
              }>
                {today.status === 'present' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {today.status.replace('_', ' ')}
              </Badge>
            </div>
          )}

          {/* Punch buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={hasPunchedIn}
              onClick={() => openPunchMap('in')}
              variant={hasPunchedIn ? 'outline' : 'default'}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {hasPunchedIn ? 'Punched In' : 'Punch In'}
            </Button>
            <Button
              className="flex-1"
              disabled={!hasPunchedIn || hasPunchedOut}
              onClick={() => openPunchMap('out')}
              variant={hasPunchedOut ? 'outline' : 'secondary'}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {hasPunchedOut ? 'Punched Out' : 'Punch Out'}
            </Button>
          </div>

          {/* Location of last punch */}
          {today?.checkInLocation && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground line-clamp-2">
                {today.checkInLocation.address || `${today.checkInLocation.latitude}, ${today.checkInLocation.longitude}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {renderMapDialog()}
    </>
  );
}
