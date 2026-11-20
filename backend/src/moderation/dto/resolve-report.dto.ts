import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_ACTIONS = ['dismiss', 'hide', 'delete'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** GEN-10 */
export class ResolveReportDto {
  @ApiProperty({
    enum: REPORT_ACTIONS,
    description:
      'dismiss = no action on the content; hide = only the author and admins can see it; delete = removed permanently. hide and delete also resolve every other open report on the same content.',
  })
  @IsIn([...REPORT_ACTIONS])
  action!: ReportAction;

  @ApiPropertyOptional({ example: 'Confirmed spam', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** GEN-10: optional note for direct hide/unhide/delete. */
export class ModerationNoteDto {
  @ApiPropertyOptional({ example: 'Hate speech', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
