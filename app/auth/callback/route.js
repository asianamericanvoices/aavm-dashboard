import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    
    try {
      await supabase.auth.exchangeCodeForSession(code);
      
      // Get the user after successful auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check user status in our users table
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        // If user is approved, redirect to main app
        if (userData?.role && userData.role !== 'pending_approval') {
          return NextResponse.redirect(new URL('/', requestUrl.origin));
        }
        
        // If pending approval, redirect to login page
        return NextResponse.redirect(new URL('/login', requestUrl.origin));
      }
    } catch (error) {
      console.error('Auth callback error:', error);
    }
  }

  // If something went wrong, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
