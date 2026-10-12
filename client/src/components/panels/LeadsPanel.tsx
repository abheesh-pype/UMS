import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, CheckCircle, Link2, Copy, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function LeadsPanel() {
  const { user } = useAuth();
  const isSalesAdmin = user?.role === 'sales_admin';

  const [leads, setLeads] = useState<any[]>([]);
  const [referralLinks, setReferralLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    centerName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    source: 'website',
    status: 'new',
    notes: ''
  });

  const [centerFormData, setCenterFormData] = useState({
    name: '',
    code: '',
    address: '',
    contact: '',
    email: '',
  });

  useEffect(() => {
    fetchLeads();
    if (isSalesAdmin) fetchReferralLinks();
  }, [isSalesAdmin]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await api.get('/sales/leads');
      setLeads(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralLinks = async () => {
    try {
      const response = await api.get('/referrals/my-links');
      setReferralLinks(response.data.data || []);
    } catch (_ignored) { /* intentionally silent */ }
  };

  const generateReferralLink = async () => {
    try {
      await api.post('/referrals/generate');
      fetchReferralLinks();
      toast.success('Referral link generated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate referral link');
    }
  };

  const copyReferralLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success('Referral link copied to clipboard'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/sales/leads/${editingId}`, formData);
      } else {
        await api.post('/sales/leads', formData);
      }
      setDialogOpen(false);
      resetForm();
      fetchLeads();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save lead');
    }
  };

  const handleEdit = (lead: any) => {
    const leadId = lead.id || lead.id;
    setEditingId(leadId);
    setFormData({
      centerName: lead.centerName || '',
      contactName: lead.contactName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      address: lead.address || '',
      source: lead.source || 'website',
      status: lead.status || 'new',
      notes: lead.notes || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/sales/leads/${id}`);
      fetchLeads();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete lead');
    }
  };

  const handleConvert = async (id: string) => {
    if (!confirm('Convert this lead to a student?')) return;
    try {
      await api.put(`/sales/leads/${id}/convert`);
      fetchLeads();
      toast.success('Lead converted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to convert lead');
    }
  };

  const openConvertToCenterDialog = (lead: any) => {
    setSelectedLead(lead);
    setCenterFormData({
      name: lead.centerName || '',
      code: '',
      address: lead.address || '',
      contact: lead.phone || '',
      email: lead.email || '',
    });
    setConvertDialogOpen(true);
  };

  const handleConvertToCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: (centerFormData.name || '').trim(),
        code: (centerFormData.code || '').trim().toUpperCase(),
        address: (centerFormData.address || '').trim(),
        contact: (centerFormData.contact || '').trim(),
        email: (centerFormData.email || '').trim().toLowerCase(),
      };
      await api.post('/operations/centers', payload);
      const leadId = selectedLead.id || selectedLead.id;
      await api.put(`/sales/leads/${leadId}`, { status: 'converted' });
      setConvertDialogOpen(false);
      fetchLeads();
      toast.success('Lead converted to Study Center successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to convert to center');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      centerName: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      source: 'website',
      status: 'new',
      notes: ''
    });
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal: 'bg-orange-100 text-orange-800',
      negotiation: 'bg-indigo-100 text-indigo-800',
      converted: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800'
    };
    return colors[status] || '';
  };

  return (
    <div className="space-y-6">
      {/* Referral Links Section — sales_admin only */}
      {isSalesAdmin && (
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                My Referral Links
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Share your referral link to earn commissions
              </p>
            </div>
            {referralLinks.length === 0 && (
              <Button onClick={generateReferralLink} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Generate Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {referralLinks.length > 0 ? (
            <div className="space-y-3">
              {referralLinks.map((link: any) => (
                <div key={link.id || link.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div className="flex-1">
                    <p className="font-mono text-sm">{link.fullUrl}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Centers: {link.metrics?.centersReferred || 0}</span>
                      <span>Students: {link.metrics?.studentsReferred || 0}</span>
                      <span>Revenue: ₹{link.metrics?.revenueGenerated || 0}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyReferralLink(link.fullUrl)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No referral links yet. Generate one to start earning!
            </p>
          )}
        </CardContent>
      </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lead Management</h2>
          <p className="text-muted-foreground">Track and convert sales leads</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Center Name</Label>
                  <Input value={formData.centerName} onChange={(e) => setFormData({...formData, centerName: e.target.value})} required />
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input value={formData.contactName} onChange={(e) => setFormData({...formData, contactName: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Source</Label>
                  <Select value={formData.source} onValueChange={(value) => setFormData({...formData, source: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No leads found</div>
          ) : (
            <div className="space-y-2">
              {leads.filter(lead => lead && (lead.id || lead.id)).map((lead) => {
                const leadId = lead.id || lead.id;
                return (
                  <div key={leadId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{lead.centerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.contactName} • {lead.email} • {lead.phone} • {lead.source}
                        </div>
                        {lead.notes && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{lead.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openConvertToCenterDialog(lead)} 
                            title="Convert to Study Center"
                          >
                            <Building2 className="w-4 h-4 text-primary" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleConvert(leadId)} 
                            title="Convert to Student"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(leadId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convert to Study Center Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Study Center</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Create a new study center from this lead
            </p>
          </DialogHeader>
          <form onSubmit={handleConvertToCenter} className="space-y-4">
            <div>
              <Label htmlFor="center-name">Center Name</Label>
              <Input
                id="center-name"
                value={centerFormData.name}
                onChange={(e) => setCenterFormData({ ...centerFormData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="center-code">Center Code</Label>
              <Input
                id="center-code"
                value={centerFormData.code}
                onChange={(e) => setCenterFormData({ ...centerFormData, code: e.target.value })}
                required
                placeholder="e.g., CTR001"
              />
            </div>
            <div>
              <Label htmlFor="center-address">Address</Label>
              <Textarea
                id="center-address"
                value={centerFormData.address}
                onChange={(e) => setCenterFormData({ ...centerFormData, address: e.target.value })}
                required
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="center-contact">Contact</Label>
                <Input
                  id="center-contact"
                  value={centerFormData.contact}
                  onChange={(e) => setCenterFormData({ ...centerFormData, contact: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="center-email">Email</Label>
                <Input
                  id="center-email"
                  type="email"
                  value={centerFormData.email}
                  onChange={(e) => setCenterFormData({ ...centerFormData, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <Building2 className="w-4 h-4 mr-2" />
                Create Study Center
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConvertDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
