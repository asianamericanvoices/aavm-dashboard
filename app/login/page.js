'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState(null);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error params
    const errorParam = searchParams.get('error');
    if (errorParam) {
      switch (errorParam) {
        case 'auth_exchange_failed':
          setError('Google login failed. Please try again.');
          break;
        case 'callback_failed':
          setError('Login callback failed. Please try again.');
          break;
        default:
          setError('Login error occurred. Please try again.');
      }
    }

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('👤 Found existing user:', user.email);
        
        // Check if user is approved
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (userData?.role && userData.role !== 'pending_approval' && userData.role !== 'disabled') {
          console.log('✅ User approved, redirecting to dashboard');
          router.push('/');
        } else {
          console.log('⏳ User pending approval');
          setUser(user);
          setUserRole(userData?.role || 'pending_approval');
        }
      }
    };
    
    getUser();
  }, [searchParams, supabase, router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Starting Google OAuth...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) {
        console.error('❌ OAuth error:', error);
        setError('Failed to start Google login. Please try again.');
      } else {
        console.log('✅ OAuth started successfully');
      }
    } catch (err) {
      console.error('💥 Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
    
    setLoading(false);
  };

  // Show pending approval state if user exists but not approved
  if (user && userRole === 'pending_approval') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Approval</h1>
          <p className="text-gray-600 mb-4">
            Your account ({user.email}) has been created and is waiting for admin approval.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            You'll receive an email once your account is approved and you can access the dashboard.
          </p>
          
          {/* For development - allow self-approval */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Development Mode:</strong> You can approve yourself for testing
              </p>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ role: 'admin' })
                      .eq('id', user.id);
                    
                    if (!error) {
                      router.push('/');
                    }
                  } catch (err) {
                    console.error('Self-approval failed:', err);
                  }
                }}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
              >
                Approve Myself (Dev Only)
              </button>
            </div>
          )}
          
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AAVM Dashboard</h1>
          <p className="text-gray-600 mt-2">Asian American Voices Media</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          New accounts require admin approval before accessing the dashboard.
        </p>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-3 bg-gray-50 rounded text-xs">
            <strong>Debug Info:</strong>
            <br />Callback URL: {window.location.origin}/auth/callback
            <br />Current URL: {window.location.href}
          </div>
        )}
      </div>
    </div>
  );
}
