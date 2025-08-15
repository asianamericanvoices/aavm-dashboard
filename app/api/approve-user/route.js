// app/api/approve-user/route.js - FIXED VERSION
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ FIXED: Use createClient with service role key directly
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // This bypasses RLS
);

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const role = url.searchParams.get('role');
  
  if (!token || !role) {
    return NextResponse.json({ error: 'Missing token or role' }, { status: 400 });
  }

  let tokenData = null;
  
  try {
    console.log('🔍 Looking for token:', token);
    
    // ✅ FIXED: Now using service role client to read tokens
    const { data: dbToken, error: dbError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();
    
    console.log('🔍 Database lookup result:', { dbToken, dbError });
    
    if (dbError || !dbToken) {
      console.log('❌ Token not found in database or error:', dbError);
      return getInvalidResponse();
    }
    
    // Check if token has expired
    if (new Date() > new Date(dbToken.expires_at)) {
      console.log('❌ Token expired');
      
      // Mark as used/expired
      await supabase
        .from('approval_tokens')
        .update({ used: true })
        .eq('token', token);
      
      return getExpiredResponse();
    }
    
    tokenData = {
      userId: dbToken.user_id,
      email: dbToken.email,
      role: dbToken.role
    };
    
    // ✅ Mark token as used
    await supabase
      .from('approval_tokens')
      .update({ used: true })
      .eq('token', token);
    
    console.log('✅ Token validated and marked as used');
        
  } catch (error) {
    console.error('💥 Error checking approval token:', error);
    return getInvalidResponse();
  }

  if (!tokenData) {
    return getInvalidResponse();
  }

  try {
    console.log('🔄 Updating user role to:', role, 'for user:', tokenData.userId);
    
    // ✅ FIXED: Update user role using service role client
    const { error } = await supabase
      .from('users')
      .update({ role: role })
      .eq('id', tokenData.userId);

    if (error) {
      console.error('❌ Error updating user role:', error);
      throw error;
    }

    console.log(`✅ User approved: ${tokenData.email} as ${role}`);

    return new NextResponse(`
      <html>
        <head>
          <title>User Approved - AAVM Dashboard</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f8fafc; 
              margin: 0;
            }
            .container { 
              max-width: 500px; 
              margin: 0 auto; 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
            }
            .success { 
              color: #059669; 
              margin-bottom: 20px;
            }
            .checkmark {
              width: 60px;
              height: 60px;
              border-radius: 50%;
              background: #059669;
              position: relative;
              margin: 0 auto 20px;
            }
            .checkmark::after {
              content: '';
              width: 20px;
              height: 35px;
              position: absolute;
              left: 22px;
              top: 10px;
              border: 3px solid white;
              border-width: 0 3px 3px 0;
              transform: rotate(45deg);
            }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin-top: 20px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .button:hover {
              background: #1d4ed8;
            }
            .user-info { 
              background: #f0f9ff; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #0ea5e9;
            }
            .user-info p {
              margin: 8px 0;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark"></div>
            <h1 class="success">User Approved Successfully!</h1>
            
            <div class="user-info">
              <p><strong>Email:</strong> ${tokenData.email}</p>
              <p><strong>Role:</strong> ${role}</p>
              <p><strong>Status:</strong> Active - Can now access dashboard</p>
            </div>
            
            <p>The user has been notified and can now log in to the AAVM Dashboard.</p>
            
            <a href="https://aavm-dashboard.vercel.app" class="button">Go to Dashboard</a>
          </div>
        </body>
      </html>
    `, { 
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Approval error:', error);
    
    return new NextResponse(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #ef4444;">❌ Approval Failed</h1>
          <p>There was an error approving this user. Please try again or approve manually in Supabase.</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <a href="https://aavm-dashboard.vercel.app" style="color: #2563eb;">Go to Dashboard</a>
        </body>
      </html>
    `, { 
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

function getInvalidResponse() {
  return new NextResponse(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #ef4444;">❌ Invalid or Expired Link</h1>
        <p>This approval link is no longer valid. It may have already been used or expired.</p>
        <a href="https://aavm-dashboard.vercel.app" style="color: #2563eb;">Go to Dashboard</a>
      </body>
    </html>
  `, { 
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function getExpiredResponse() {
  return new NextResponse(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #ef4444;">❌ Expired Link</h1>
        <p>This approval link has expired. Please approve the user manually in Supabase.</p>
        <a href="https://aavm-dashboard.vercel.app" style="color: #2563eb;">Go to Dashboard</a>
      </body>
    </html>
  `, { 
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
