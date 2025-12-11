import { NextRequest, NextResponse } from 'next/server';
import { deleteProject as deleteProjectAction } from '@/lib/actions';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: '缺少專案 ID' },
        { status: 400 }
      );
    }
    
    await deleteProjectAction(projectId);

    return NextResponse.json({ 
      success: true, 
      message: '專案已成功刪除' 
    });

  } catch (error) {
    console.error('刪除專案失敗:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '刪除專案失敗' 
      },
      { status: 500 }
    );
  }
}
