
import { NextRequest, NextResponse } from 'next/server';
import { deleteSubProjects } from '@/lib/actions';

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
    const { subProjectIds } = await request.json();

    if (!projectId || !subProjectIds || !Array.isArray(subProjectIds) || subProjectIds.length === 0) {
      return NextResponse.json(
        { success: false, message: '缺少專案 ID 或子專案 ID' },
        { status: 400 }
      );
    }
    
    await deleteSubProjects(projectId, subProjectIds);

    return NextResponse.json({ 
      success: true, 
      message: '所選的子專案已成功刪除' 
    });

  } catch (error) {
    console.error('刪除子專案失敗:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '刪除子專案失敗' 
      },
      { status: 500 }
    );
  }
}
