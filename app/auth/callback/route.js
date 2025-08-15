import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    
    try {
      // Exchange code for session
      const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth exchange error:', error);
        return NextResponse.redirect(new URL('/login?error=auth_exchange_failed', requestUrl.origin));
      }

      if (user) {
        // Check if user exists in our users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        // If user doesn't exist, create them (backup in case trigger didn't work)
        if (userError && userError.code === 'PGRST116') {
          console.log('Creating new user record for:', user.email);
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              role: 'pending_approval'
            });
          
          if (insertError) {
            console.error('Error creating user:', insertError);
          }
        }
      }
    } catch (err) {
      console.error('Callback error:', err);
      return NextResponse.redirect(new URL('/login?error=callback_failed', requestUrl.origin));
    }
  }

  // Always redirect to home, let AuthWrapper handle the rest
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
