import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { GisService } from '../../../services/gis.service';
import { MapEditType } from '../../../model/gis';
import { CirclePanelComponent } from './circle/circle-panel.component';
import { RoutePanelComponent } from './route/route-panel.component';

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
    ],
})
export class MapPanelComponent implements OnInit {
    @ViewChild(CirclePanelComponent) circlePanel: CirclePanelComponent;
    @Output() cancelEmitter = new EventEmitter<void>();
    @Output() focusMarkerEmitter = new EventEmitter<any>();

    modeList: { label: string; value: MapEditType }[] = [
        { label: '範圍圈選', value: 'circle' },
        { label: '軌跡繪製', value: 'route' },
    ];

    constructor(public gisService: GisService) { }

    ngOnInit(): void {
        this.gisService.mapEditType = 'circle';
    }

    tabChange() {
        this.cancelEmitter.emit();
        this.circlePanel.reset();
    }
}
