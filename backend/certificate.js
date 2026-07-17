import PDFDocument from 'pdfkit';

export function streamVictoryCertificate(res, { playerName = 'Player', elo = 2400, why = 'checkmate' }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="kiruma-souichi-victory-certificate.pdf"');

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  doc.pipe(res);

  const W = doc.page.width, H = doc.page.height;

  doc.rect(0, 0, W, H).fill('#0f0f0f');
  doc.rect(24, 24, W - 48, H - 48).lineWidth(3).stroke('#d4af37');
  doc.rect(34, 34, W - 68, H - 68).lineWidth(0.75).stroke('#d4af37');

  doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(34)
    .text('KIRUMA SOUICHI CHESS', 0, 140, { width: W, align: 'center' });

  doc.fillColor('#d4af37').font('Helvetica-Oblique').fontSize(16)
    .text('Secret Strategy Certificate', 0, 178, { width: W, align: 'center' });

  doc.moveTo(150, 205).lineTo(W - 150, 205).lineWidth(1).stroke('#d4af37');

  doc.fillColor('#e6e6e6').font('Helvetica').fontSize(13)
    .text('This certifies that', 0, 250, { width: W, align: 'center' });

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(28)
    .text(playerName, 0, 280, { width: W, align: 'center' });

  doc.fillColor('#e6e6e6').font('Helvetica').fontSize(13)
    .text('has defeated the demon, Kiruma Souichi,', 0, 322, { width: W, align: 'center' })
    .text(`at the ${elo}+ ELO difficulty by ${why}, and proven their worth.`, 0, 340, { width: W, align: 'center' });

  doc.fillColor('#d4af37').font('Helvetica-BoldOblique').fontSize(15)
    .text('"You defeated the demon. Congratulations!"', 0, 392, { width: W, align: 'center' });

  doc.fillColor('#bbbbbb').font('Helvetica').fontSize(11)
    .text('Reward unlocked: Kiruma_souchii Secret Strategy PDF', 0, 420, { width: W, align: 'center' })
    .text('(download from the victory screen)', 0, 438, { width: W, align: 'center' });

  doc.fillColor('#999999').font('Helvetica-Bold').fontSize(10)
    .text("Kiruma's Secret Opening Principles:", 90, 470);

  const tips = [
    '1. Control the center before launching any attack.',
    '2. Develop knights before bishops, castle early for king safety.',
    '3. Never move the same piece twice in the opening without reason.',
    '4. Calculate forcing lines: checks, captures, and threats first.',
    '5. A quiet position often hides the sharpest tactic.',
  ];
  doc.font('Helvetica').fontSize(10).fillColor('#bbbbbb');
  tips.forEach((t, i) => doc.text(t, 90, 495 + i * 20));

  doc.fillColor('#777777').fontSize(9)
    .text('Kiruma Souichi Chess — ' + new Date().toLocaleDateString(), 0, H - 60, { width: W, align: 'center' });

  doc.end();
}
