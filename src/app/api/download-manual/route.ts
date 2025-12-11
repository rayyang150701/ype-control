import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET() {
  try {
    // Get the path to the file in the public directory
    const filePath = path.join(process.cwd(), 'public', 'manual.pdf');
    
    // Read the file content
    const fileBuffer = await fs.readFile(filePath);

    // Create a response with the file content and appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="操作手冊.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to read manual file:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}
