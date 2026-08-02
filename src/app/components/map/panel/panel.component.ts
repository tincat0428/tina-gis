import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { GisService } from '../../../services/gis.service';
import { MapEditType } from '../../../model/gis';
import { CirclePanelComponent } from './circle/circle-panel.component';
import { RoutePanelComponent } from './route/route-panel.component';
import { RegionPanelComponent } from './region/region-panel.component';

@Component({
    selector: 'app-map-panel',
    templateUrl: './panel.component.html',
    styleUrls: ['./panel.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        TabsModule,
        CirclePanelComponent,
        RoutePanelComponent,
        RegionPanelComponent,
    ],
})
export class MapPanelComponent implements OnInit {
    @ViewChild(CirclePanelComponent) circlePanel: CirclePanelComponent;
    @ViewChild(RegionPanelComponent) regionPanel: RegionPanelComponent;
    @Output() cancelEmitter = new EventEmitter<void>();
    @Output() focusMarkerEmitter = new EventEmitter<any>();

    modeList: { label: string; value: MapEditType; icon: string }[] = [
        { label: '範圍圈選', value: 'circle', icon: 'fa-regular fa-circle-dot' },
        { label: '軌跡繪製', value: 'route', icon: 'fa-solid fa-route' },
        { label: '行政區圈選', value: 'region', icon: 'fa-solid fa-draw-polygon' },
    ];

    constructor(public gisService: GisService) { }

    ngOnInit(): void {
        this.gisService.mapEditType = this.modeList[0].value;
    }

    tabChange() {
        this.cancelEmitter.emit();
        this.resetPanels();
    }

    /** 回到第一個 tab（側欄重新開啟時使用） */
    resetToFirstTab() {
        this.gisService.mapEditType = this.modeList[0].value;
        this.resetPanels();
    }

    private resetPanels() {
        this.circlePanel?.reset();
        this.regionPanel?.reset();
    }
}
