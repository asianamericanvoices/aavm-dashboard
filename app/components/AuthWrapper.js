'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function AuthWrapper({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 Checking authentication...');
        
        // Check session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('📋 Session check:', { session: !!session, error: sessionError });
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('👤 User check:', { user: !!user, userId: user?.id, email: user?.email, error: userError });
        
        if (userError) {
          console.error('❌ Auth error:', userError);
          router.push('/login');
          return;
        }

        if (!user) {
          console.log('❌ No user logged in');
          router.push('/login');
          return;
        }

        console.log('✅ User authenticated:', user.email, 'ID:', user.id);

        // Test database connection
        console.log('🔌 Testing database connection...');
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('*')
          .limit(1);
        
        console.log('🔌 Database test:', { data: testData, error: testError });

        // Check user's role and approval status
        console.log('🔍 Checking user role for ID:', user.id);
        const { data: userData, error: roleError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('👤 User data query result:', { userData, roleError });

        if (roleError) {
          console.error('❌ Role check error:', roleError);
          console.error('❌ Error code:', roleError.code);
          console.error('❌ Error message:', roleError.message);
          console.error('❌ Full error:', JSON.stringify(roleError, null, 2));
          
          // If user doesn't exist in users table, create them
          if (roleError.code === 'PGRST116') {
            console.log('🔧 Creating user record...');
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                role: 'pending_approval'
              });
            
            if (insertError) {
              console.error('❌ Failed to create user:', insertError);
              console.error('❌ Insert error code:', insertError.code);
              console.error('❌ Insert error message:', insertError.message);
              setError(`Failed to set up user account: ${insertError.message}`);
              return;
            }
            
            // Set to pending approval after creation
            setUser(user);
            setUserRole('pending_approval');
            setLoading(false);
            return;
          }
          
          setError(`Database error: ${roleError.message} (Code: ${roleError.code})`);
          return;
        }

        if (!userData || userData.role === 'disabled') {
          console.log('❌ User disabled or invalid role');
          router.push('/login');
          return;
        }

        // If user is pending approval, show pending state
        if (userData.role === 'pending_approval') {
          console.log('⏳ User pending approval');
          setUser(user);
          setUserRole('pending_approval');
          setLoading(false);
          return;
        }

        // User is authenticated and approved
        console.log('✅ User approved with role:', userData.role);
        setUser(user);
        setUserRole(userData.role);
        setLoading(false);

      } catch (error) {
        console.error('💥 Auth check error:', error);
        setError('Authentication error');
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event);
        
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/login');
        } else if (event === 'SIGNED_IN' && session) {
          // Recheck auth when signed in
          checkAuth();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
          {error && (
            <p className="mt-2 text-red-600 text-sm">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-900 mb-4">Authentication Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null; // Will redirect to login
  }

  // Show pending approval state
  if (userRole === 'pending_approval') {
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
                      window.location.reload();
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

  // User is authenticated and approved - render the dashboard
  return children;
}
