import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CctvMarker } from '../../../model/gis';

@Component({
    selector: 'app-map-video',
    templateUrl: './map-video.component.html',
    styleUrls: ['./map-video.component.scss'],
    standalone: true,
    imports: [CommonModule, ButtonModule],
})
export class MapVideoComponent {
    @Input() rowData: CctvMarker;

    /** 前往即時影像監看 */
    goToVideoView() {
        if (this.rowData?.CCTVId) {
            window.open(`/RealtimeVideos?CCTV=${this.rowData.CCTVId}`, '_blank');
        }
    }

    /** 前往歷史影像調閱 */
    goToApplyVideo() {
        if (this.rowData?.CCTVId) {
            window.open(
                `/HistoryVideos/ApplyForm?CamId=${this.rowData.CCTVId}`,
                '_blank',
            );
        }
    }
}
