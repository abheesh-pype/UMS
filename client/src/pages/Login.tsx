import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';



export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) setError('Invalid email/User ID or password');
    } catch (error: any) {
      const responseData = error.response?.data;
      const serverMessage = typeof responseData === 'string'
        ? responseData
        : responseData?.message;
      setError(serverMessage || 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src="/logo.png" alt="UMS" className="w-12 h-12 object-contain rounded-xl shadow-lg" />
          <span className="text-3xl font-bold text-[#0F172A] tracking-tight">UMS</span>
        </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#0F172A] mb-2">Sign in to your account</h2>
            <p className="text-sm text-slate-500">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address or User ID
              </label>
              <Input
                id="email"
                type="text"
                placeholder="name@company.com or User ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-slate-300 focus:border-[#0F172A] focus:ring-[#0F172A]"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-300 focus:border-[#0F172A] focus:ring-[#0F172A]"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#0F172A] hover:bg-[#1E293B] text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>


        </div>
      </div>
  );
}
