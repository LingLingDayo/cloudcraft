import type { ChunkPipelineContext, ChunkPipelineStage } from './ChunkPipelineTypes';

export class ChunkPipeline {
  private stages: ChunkPipelineStage[] = [];

  public execute(context: ChunkPipelineContext): void {
    for (const stage of this.stages) {
      stage.execute(context);
    }
  }

  public addStage(stage: ChunkPipelineStage): void {
    this.stages.push(stage);
  }

  public insertStageBefore(targetStageName: string, stage: ChunkPipelineStage): void {
    const idx = this.stages.findIndex(s => s.name === targetStageName);
    if (idx !== -1) {
      this.stages.splice(idx, 0, stage);
    } else {
      this.stages.push(stage);
    }
  }

  public insertStageAfter(targetStageName: string, stage: ChunkPipelineStage): void {
    const idx = this.stages.findIndex(s => s.name === targetStageName);
    if (idx !== -1) {
      this.stages.splice(idx + 1, 0, stage);
    } else {
      this.stages.push(stage);
    }
  }

  public getStages(): ChunkPipelineStage[] {
    return this.stages;
  }
}
