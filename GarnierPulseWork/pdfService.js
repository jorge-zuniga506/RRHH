const PDFDocument = require('pdfkit');

/**
 * Generates a professional PDF climate report for a given area/period
 * Returns a Buffer with the full PDF content
 */
async function generateClimatePDF({ area, period, report, dashboardData }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: `Reporte de Clima Organizacional — ${area}`,
          Author: 'Garnier PulseWork AI',
          Subject: 'Análisis de Bienestar Laboral',
          CreationDate: new Date(),
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Color palette
      const GREEN  = '#10b981';
      const PURPLE = '#6366f1';
      const DARK   = '#0f172a';
      const GRAY   = '#64748b';
      const RED    = '#ef4444';
      const AMBER  = '#f59e0b';
      const WHITE  = '#f8fafc';

      const pageW = doc.page.width - 120; // usable width

      // ═══════════════════════════════════════════
      // HEADER BANNER
      // ═══════════════════════════════════════════
      doc.rect(0, 0, doc.page.width, 120).fill(DARK);

      // Logo circle
      doc.circle(80, 60, 30).fill(GREEN);
      doc.fontSize(20).fillColor(WHITE).text('♥', 68, 47, { lineBreak: false });

      // Title
      doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold')
        .text('Garnier PulseWork', 125, 28, { lineBreak: false });
      doc.fontSize(11).fillColor('#94a3b8').font('Helvetica')
        .text('Reporte Ejecutivo de Clima Organizacional', 125, 54, { lineBreak: false });

      // Date badge
      const dateStr = new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.fontSize(9).fillColor('#64748b').text(`Generado el ${dateStr}`, 125, 74, { lineBreak: false });

      // Confidential badge
      doc.rect(doc.page.width - 145, 42, 85, 20).fill('#1e293b');
      doc.fontSize(8).fillColor('#f59e0b').font('Helvetica-Bold')
        .text('CONFIDENCIAL', doc.page.width - 140, 47, { lineBreak: false });

      doc.y = 140;

      // ═══════════════════════════════════════════
      // AREA + PERIOD TITLE
      // ═══════════════════════════════════════════
      doc.rect(60, doc.y, pageW, 50).fill('#f0fdf4');
      doc.rect(60, doc.y, 4, 50).fill(GREEN);

      doc.fontSize(16).fillColor('#065f46').font('Helvetica-Bold')
        .text(`Área Analizada: ${area}`, 76, doc.y + 10, { lineBreak: false });
      doc.fontSize(10).fillColor(GRAY).font('Helvetica')
        .text(`Período: ${period === 'semana' ? 'Esta Semana' : 'Este Mes'}`, 76, doc.y + 30, { lineBreak: false });

      doc.y += 70;

      // ═══════════════════════════════════════════
      // WELLNESS STATUS BADGE
      // ═══════════════════════════════════════════
      const statusColors = {
        saludable:      { bg: '#d1fae5', text: '#065f46', label: '✅ SALUDABLE' },
        en_observacion: { bg: '#fef3c7', text: '#92400e', label: '⚠️ EN OBSERVACIÓN' },
        en_alerta:      { bg: '#fee2e2', text: '#991b1b', label: '🔴 EN ALERTA CRÍTICA' },
      };
      const wStatus = report.wellnessStatus || 'saludable';
      const sc = statusColors[wStatus] || statusColors.saludable;

      doc.rect(60, doc.y, pageW, 36).fill(sc.bg);
      doc.fontSize(13).fillColor(sc.text).font('Helvetica-Bold')
        .text(`Estado de Bienestar: ${sc.label}   |   Calificación: ${report.rating}`, 76, doc.y + 11);
      doc.y += 52;

      // ═══════════════════════════════════════════
      // KPI METRICS GRID (from dashboardData)
      // ═══════════════════════════════════════════
      doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Métricas Clave del Período', 60, doc.y);
      doc.y += 18;

      const areaData = dashboardData?.areaWellness?.find(a =>
        a.area.toLowerCase().includes(area.toLowerCase())
      );

      const kpis = [
        { label: 'Promedio General', value: areaData?.score || dashboardData?.overallAverage || '—', color: GREEN },
        { label: 'Total Registros', value: areaData?.count || dashboardData?.totalRegistrations || 0, color: PURPLE },
        { label: 'Tasa Participación', value: `${dashboardData?.participationRate || 0}%`, color: AMBER },
        { label: 'Alertas Activas', value: dashboardData?.alerts?.length || 0, color: RED },
      ];

      const kpiW = pageW / 4 - 6;
      let kpiX = 60;
      kpis.forEach(kpi => {
        doc.rect(kpiX, doc.y, kpiW, 60).fill('#f8fafc').stroke('#e2e8f0');
        doc.rect(kpiX, doc.y, kpiW, 4).fill(kpi.color);
        doc.fontSize(9).fillColor(GRAY).font('Helvetica')
          .text(kpi.label, kpiX + 8, doc.y + 12, { width: kpiW - 16 });
        doc.fontSize(22).fillColor(kpi.color).font('Helvetica-Bold')
          .text(String(kpi.value), kpiX + 8, doc.y + 26, { width: kpiW - 16 });
        kpiX += kpiW + 8;
      });

      doc.y += 76;

      // ═══════════════════════════════════════════
      // EXECUTIVE SUMMARY
      // ═══════════════════════════════════════════
      doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Resumen Ejecutivo (Análisis IA)', 60, doc.y);
      doc.y += 10;
      doc.rect(60, doc.y, pageW, 1).fill('#e2e8f0');
      doc.y += 14;

      doc.fontSize(10).fillColor('#334155').font('Helvetica')
        .text(report.summary || 'Sin resumen disponible.', 60, doc.y, {
          width: pageW, align: 'justify', lineGap: 4
        });

      doc.y += doc.heightOfString(report.summary || '', { width: pageW }) + 24;

      // ═══════════════════════════════════════════
      // EMOTIONAL DISTRIBUTION CHART (horizontal bars)
      // ═══════════════════════════════════════════
      doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Distribución Emocional del Equipo', 60, doc.y);
      doc.y += 18;

      const emotions = [
        { label: '😄 Muy Bien',     key: 'muy_bien',     color: GREEN },
        { label: '🙂 Bien',          key: 'bien',          color: PURPLE },
        { label: '😐 Neutral',       key: 'neutral',       color: AMBER },
        { label: '😰 Estresado',     key: 'estresado',     color: '#f97316' },
        { label: '😔 Desmotivado',   key: 'desmotivado',   color: RED },
      ];

      const dist = dashboardData?.distribution || {};
      const totalDist = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

      emotions.forEach(em => {
        const count = dist[em.key] || 0;
        const pct   = Math.round((count / totalDist) * 100);
        const barW  = Math.max(2, (pct / 100) * (pageW - 100));

        doc.fontSize(9).fillColor('#475569').font('Helvetica').text(em.label, 60, doc.y + 3, { width: 90 });
        doc.rect(155, doc.y, pageW - 100, 14).fill('#f1f5f9');
        doc.rect(155, doc.y, barW, 14).fill(em.color);
        doc.fontSize(8).fillColor('#334155').font('Helvetica-Bold')
          .text(`${count} (${pct}%)`, 155 + barW + 6, doc.y + 2, { lineBreak: false });
        doc.y += 20;
      });

      doc.y += 10;

      // ═══════════════════════════════════════════
      // STRATEGIC RECOMMENDATIONS
      // ═══════════════════════════════════════════
      if (doc.y > 620) doc.addPage(); // New page if needed

      doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Recomendaciones Estratégicas (IA)', 60, doc.y);
      doc.y += 10;
      doc.rect(60, doc.y, pageW, 1).fill('#e2e8f0');
      doc.y += 14;

      const recs = report.recommendations || [];
      recs.forEach((rec, idx) => {
        doc.rect(60, doc.y, 20, 20).fill(PURPLE);
        doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
          .text(String(idx + 1), 67, doc.y + 5, { lineBreak: false });

        doc.rect(84, doc.y, pageW - 24, 20).fill('#f8fafc').stroke('#e2e8f0');
        doc.fontSize(9).fillColor('#334155').font('Helvetica')
          .text(rec, 92, doc.y + 5, { width: pageW - 38, lineBreak: false });

        doc.y += 26;
      });

      doc.y += 12;

      // ═══════════════════════════════════════════
      // RECURRING TOPICS SECTION
      // ═══════════════════════════════════════════
      if (dashboardData?.recurringTopics?.length > 0) {
        if (doc.y > 680) doc.addPage();

        doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Temas Recurrentes Detectados por IA', 60, doc.y);
        doc.y += 18;

        const topicColors = [GREEN, PURPLE, AMBER, '#f97316', RED, '#8b5cf6', '#06b6d4'];
        let topicX = 60;
        let topicY = doc.y;

        dashboardData.recurringTopics.slice(0, 8).forEach((topic, idx) => {
          const tc = topicColors[idx % topicColors.length];
          const tw = topic.name.length * 6 + 30;

          if (topicX + tw > doc.page.width - 60) {
            topicX = 60;
            topicY += 28;
          }

          doc.rect(topicX, topicY, tw, 20).fill(`${tc}22`).stroke(`${tc}88`);
          doc.fontSize(8).fillColor(tc).font('Helvetica-Bold')
            .text(`${topic.name} ×${topic.value}`, topicX + 8, topicY + 6, { lineBreak: false });

          topicX += tw + 8;
        });

        doc.y = topicY + 36;
      }

      // ═══════════════════════════════════════════
      // ACTIVE ALERTS TABLE
      // ═══════════════════════════════════════════
      if (dashboardData?.alerts?.length > 0) {
        if (doc.y > 680) doc.addPage();

        doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text('Alertas de Bienestar Activas', 60, doc.y);
        doc.y += 18;

        dashboardData.alerts.slice(0, 5).forEach(alert => {
          const isAlert = alert.severity === 'en_alerta';
          const ac = isAlert ? RED : AMBER;
          doc.rect(60, doc.y, pageW, 36).fill(isAlert ? '#fff0f0' : '#fffbeb').stroke(ac);
          doc.rect(60, doc.y, 4, 36).fill(ac);
          doc.fontSize(9).fillColor(isAlert ? '#991b1b' : '#92400e').font('Helvetica-Bold')
            .text(`${isAlert ? '🔴 EN ALERTA' : '⚠️ EN OBSERVACIÓN'} — ${alert.area}`, 72, doc.y + 6);
          doc.fontSize(8).fillColor('#475569').font('Helvetica')
            .text(alert.message, 72, doc.y + 20, { width: pageW - 20, lineBreak: false });
          doc.y += 42;
        });

        doc.y += 8;
      }

      // ═══════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════
      const footerY = doc.page.height - 50;
      doc.rect(0, footerY - 10, doc.page.width, 60).fill('#0f172a');
      doc.fontSize(8).fillColor('#475569').font('Helvetica')
        .text(
          `Garnier PulseWork AI — Reporte Confidencial | Generado automáticamente para uso gerencial exclusivo | ${new Date().toISOString()}`,
          60, footerY + 4, { width: pageW, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateClimatePDF };
