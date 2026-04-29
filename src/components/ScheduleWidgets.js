/**
 * Schedule Widgets Component
 * Renders Today's Schedule and Weekly Schedule.
 */
import ScheduleService from '../services/ScheduleService.js';
import GLOBAL_STORE from '../services/Store.js';

const ScheduleWidgets = {
    init() {
        GLOBAL_STORE.subscribe(() => this.render());
        this.render();
    },

    render() {
        this.renderToday();
        this.renderWeekly();
    },

    renderToday() {
        const el = document.getElementById('today-schedule');
        const lbl = document.getElementById('today-date-label');
        if (!el) return;

        if (GLOBAL_STORE.state.loading.schedule) {
            el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i></div>';
            return;
        }

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        if (lbl) lbl.textContent = `${days[now.getDay()]} ${todayStr}`;

        const classes = (GLOBAL_STORE.state.liveClasses || [])
            .filter(c => c && c.date === todayStr)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        if (classes.length === 0) {
            el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fas fa-moon fa-2x" style="opacity:0.3;"></i><p style="margin-top:10px;">لا توجد حصص اليوم</p></div>`;
            return;
        }

        const computeStatus = (c) => {
            const now = new Date();
            const cDate = new Date(c.date + 'T' + c.time);
            const cEnd = new Date(cDate.getTime() + (c.duration || 60) * 60000);
            if (now < cDate) return 'scheduled';
            if (now > cEnd) return 'finished';
            return 'live';
        };

        el.innerHTML = classes.map(c => {
            const status = computeStatus(c);
            const db = GLOBAL_STORE.state.db;
            const gName = (db?.classes?.[c.classId]?.name || '') + ' • ' + (db?.classes?.[c.classId]?.groups?.[c.groupId]?.name || '');
            const dotColor = status === 'live' ? 'var(--danger)' : status === 'finished' ? 'var(--success)' : 'var(--warning)';
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;${status === 'live' ? 'animation:pulse 1.5s infinite;' : ''}"></div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:13px;">${c.title || 'بدون عنوان'}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${gName} | ${c.time || '—'} (${c.duration || 0} د)</div>
                </div>
                ${status !== 'finished' ? `<button class="btn btn-sm" onclick="window.open('${c.link || '#'}','_blank');" style="background:${status === 'live' ? 'var(--danger)' : 'var(--primary)'}; font-size:11px; padding:4px 10px;"><i class="fas fa-play"></i></button>` : '<i class="fas fa-check-circle" style="color:var(--success);"></i>'}
            </div>`;
        }).join('');
    },

    renderWeekly() {
        const el = document.getElementById('weekly-schedule');
        const lbl = document.getElementById('week-label');
        if (!el) return;

        if (GLOBAL_STORE.state.loading.schedule) {
            el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i></div>';
            return;
        }

        const now = new Date();
        const dayOfWeek = now.getDay();
        const offsetToSaturday = (dayOfWeek + 1) % 7;
        const weekOffset = GLOBAL_STORE.state.scheduleWeekOffset || 0;

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - offsetToSaturday + (weekOffset * 7));
        weekStart.setHours(0, 0, 0, 0);

        const dayNames = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });

        if (lbl) {
            const s = days[0].toISOString().slice(0, 10);
            const e = days[6].toISOString().slice(0, 10);
            lbl.textContent = `${s} → ${e}`;
        }

        const todayStr = now.toISOString().slice(0, 10);
        let html = `<table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr>`;
        days.forEach((d, i) => {
            const ds = d.toISOString().slice(0, 10);
            const isToday = ds === todayStr;
            html += `<th style="padding:6px 4px;text-align:center;font-weight:700;color:${isToday ? 'var(--primary)' : 'var(--text-muted)'};border-bottom:2px solid ${isToday ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};">${dayNames[i]}<br><span style="font-size:10px;font-weight:400;">${ds.slice(5)}</span></th>`;
        });
        html += `</tr></thead><tbody><tr>`;

        days.forEach(d => {
            const ds = d.toISOString().slice(0, 10);
            const dayClasses = (GLOBAL_STORE.state.liveClasses || [])
                .filter(c => c && c.date === ds)
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const isToday = ds === todayStr;
            html += `<td style="padding:4px;vertical-align:top;min-width:85px;background:${isToday ? 'rgba(109,58,238,0.07)' : 'transparent'};">`;
            if (dayClasses.length === 0) {
                html += `<div style="text-align:center;color:rgba(255,255,255,0.15);font-size:18px;padding:8px;">·</div>`;
            } else {
                dayClasses.forEach(c => {
                    const status = this.computeStatus(c);
                    const col = status === 'live' ? 'var(--danger)' : status === 'finished' ? 'var(--success)' : 'var(--primary)';
                    const db = GLOBAL_STORE.state.db;
                    const gName = db?.classes?.[c.classId]?.groups?.[c.groupId]?.name || '';
                    html += `<div title="${c.title || 'بدون عنوان'} | ${gName}" style="background:${col};border-radius:6px;padding:4px 6px;margin-bottom:4px;cursor:pointer;opacity:${status === 'finished' ? '0.5' : '1'};" onclick="window.open('${c.link || '#'}','_blank')">
                        <div style="font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;">${c.title || 'بدون عنوان'}</div>
                        <div style="color:rgba(255,255,255,0.8);font-size:10px;">${c.time || '—'} | ${gName}</div>
                    </div>`;
                });
            }
            html += `</td>`;
        });
        html += `</tr></tbody></table>`;
        el.innerHTML = html;
    },

    computeStatus(c) {
        const now = new Date();
        const cDate = new Date(c.date + 'T' + c.time);
        const cEnd = new Date(cDate.getTime() + (c.duration || 60) * 60000);
        if (now < cDate) return 'scheduled';
        if (now > cEnd) return 'finished';
        return 'live';
    }
};

window.ScheduleWidgets = ScheduleWidgets;
export default ScheduleWidgets;
