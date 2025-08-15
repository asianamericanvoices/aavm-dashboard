// app/api/webhooks/user-approval/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📧 User approval webhook triggered:', body);

    // Verify this is a new user insertion
    if (body.type === 'INSERT' && body.table === 'users') {
      const newUser = body.record;
      
      // Only send email for pending approval users
      if (newUser.role === 'pending_approval') {
        await sendUserApprovalEmail(newUser);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

// app/api/webhooks/user-approval/route.js
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📧 User approval webhook triggered:', body);

    // Verify this is a new user insertion
    if (body.type === 'INSERT' && body.table === 'users') {
      const newUser = body.record;
      
      // Only send email for pending approval users
      if (newUser.role === 'pending_approval') {
        await sendUserApprovalEmail(newUser);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

async function sendUserApprovalEmail(user) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ No Resend API key configured');
      return;
    }

    const { data, error } = await resend.emails.send({
      from: 'AAVM Dashboard <noreply@mail.asianamericanvoices.us>',
      to: ['digest@asianamericanvoices.us'],
      subject: '🔔 New User Approval Request - AAVM Dashboard',
      html: generateApprovalEmailHTML(user),
    });

    if (error) {
      throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }

    console.log('✅ Approval email sent via Resend:', data.id);
  } catch (error) {
    console.error('❌ Failed to send approval email:', error);
  }
}

function generateApprovalEmailHTML(user) {
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>New User Approval Request</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
            .footer { background: #1e293b; color: white; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .user-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2563eb; }
            .warning { background: #fef3c7; padding: 10px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔔 New User Approval Request</h1>
                <p>AAVM Dashboard - User Management</p>
            </div>
            
            <div class="content">
                <p>Hi Admin,</p>
                
                <p>A new user has signed up for the AAVM Dashboard and is waiting for approval:</p>
                
                <div class="user-info">
                    <h3>📋 User Details</h3>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>User ID:</strong> ${user.id}</p>
                    <p><strong>Signed up:</strong> ${new Date(user.created_at).toLocaleString()}</p>
                    <p><strong>Current Status:</strong> Pending Approval</p>
                </div>
                
                <div class="warning">
                    <p><strong>⚠️ Action Required:</strong> This user cannot access the dashboard until you approve them.</p>
                </div>
                
                <h3>🔧 How to Approve:</h3>
                <ol>
                    <li><strong>Option 1 - Supabase Dashboard (Recommended):</strong>
                        <ul>
                            <li>Go to <a href="${supabaseUrl}" target="_blank">Supabase Dashboard</a></li>
                            <li>Navigate to Table Editor → users table</li>
                            <li>Find ${user.email} and change role from "pending_approval" to "admin"</li>
                        </ul>
                    </li>
                    <li><strong>Option 2 - SQL Query:</strong>
                        <ul>
                            <li>Go to Supabase SQL Editor</li>
                            <li>Run: <code>UPDATE users SET role = 'admin' WHERE email = '${user.email}';</code></li>
                        </ul>
                    </li>
                </ol>
                
                <p style="text-align: center; margin: 25px 0;">
                    <a href="${dashboardUrl}" class="button">🚀 Go to Dashboard</a>
                </p>
                
                <p><small><strong>Available Roles:</strong><br>
                • <strong>admin</strong> - Full dashboard access<br>
                • <strong>chinese_translator</strong> - Chinese translation approval only<br>
                • <strong>korean_translator</strong> - Korean translation approval only<br>
                • <strong>pending_approval</strong> - No access (current status)<br>
                • <strong>disabled</strong> - Blocked from access</small></p>
            </div>
            
            <div class="footer">
                <p>This is an automated message from the AAVM Dashboard user management system.</p>
                <p>Dashboard: <a href="${dashboardUrl}" style="color: #cbd5e1;">${dashboardUrl}</a></p>
            </div>
        </div>
    </body>
    </html>
  `;
}
