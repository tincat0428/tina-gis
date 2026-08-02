import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { PopoverModule } from 'primeng/popover';
import { GisService } from '../../../../services/gis.service';

@Component({
    selector: 'app-region-panel',
    templateUrl: './region-panel.component.html',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        AccordionModule,
        PopoverModule,
        CheckboxModule,
    ],
})
export class RegionPanelComponent {
    //- 地圖圖層分頁（預設展開）
    regionActiveSec: number[] = [0];
    //- 所選繪製區域（可多選，每項為該區對應的地圖資料代碼）
    selectedArea: string[][] = [];

    constructor(public gisService: GisService) { }

    /** 勾選變更時即時繪製所選行政區域（攤平並去除重複代碼） */
    drawRegionArea() {
        const mapIds = [...new Set(this.selectedArea.flat())];
        this.gisService.mapAction$.next({ type: 'draw-region', data: mapIds });
    }

    /** 清除所有已勾選的行政區 */
    reset() {
        this.selectedArea = [];
    }
}
