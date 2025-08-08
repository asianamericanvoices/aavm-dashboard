// API route for OpenAI integration
import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const keyPreview = process.env.OPENAI_API_KEY ? 
    process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found';
  
  return NextResponse.json({ 
    message: 'AI API route is working!',
    hasApiKey,
    keyPreview
  });
}

export async function POST(request) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { action, title, content, language, summary } = await request.json();

    if (action === 'summarize') {
      const prompt = `You are a professional journalist. Write a 300-400 word objective summary of: "${title}". Focus on facts and maintain journalistic objectivity.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_
