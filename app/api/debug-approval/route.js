// Add this debug route: app/api/debug-approval/route.js
// This will help us see what's happening with tokens

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Check if token exists in database
    const { data: dbTokens, error: dbError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token);
    
    console.log('🔍 Database lookup:', { dbTokens, dbError });
    
    // Check in-memory storage too
    const memoryTokens = global.approvalTokens || new Map();
    const memoryToken = memoryTokens.get(token);
    
    console.log('🔍 Memory lookup:', { 
      hasMemoryToken: !!memoryToken,
      memoryToken: memoryToken ? {
        userId: memoryToken.userId,
        email: memoryToken.email,
        expires: new Date(memoryToken.expires).toISOString(),
        isExpired: Date.now() > memoryToken.expires
      } : null
    });
    
    return NextResponse.json({
      token: token,
      database: {
        found: !!dbTokens && dbTokens.length > 0,
        tokens: dbTokens,
        error: dbError
      },
      memory: {
        found: !!memoryToken,
        token: memoryToken ? {
          userId: memoryToken.userId,
          email: memoryToken.email,
          expires: new Date(memoryToken.expires).toISOString(),
          isExpired: Date.now() > memoryToken.expires
        } : null,
        totalMemoryTokens: memoryTokens.size
      },
      serverTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: error.message,
      token: token 
    }, { status: 500 });
  }
}
