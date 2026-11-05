import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';

mkdirSync('public/media', { recursive: true });
mkdirSync('src/data', { recursive: true });
const captions = [
  'At the edge of a quiet village stood a tree, so old that no one remembered its first leaf. Every evening, a child named Lela sat beneath its branches and listened.',
  'One evening, a small golden bird arrived. It sang a melody Lela had never heard. The bird flew toward the river, and Lela followed the song.',
  'At the water, she found her grandmother, waiting with a woven basket. “Every story is a seed,” her grandmother said. “When we share it, something new can grow.”',
  'Lela returned to the old tree. This time, she told a story of her own. And under its wide branches, the village gathered to listen.',
];
if (existsSync('public/media/part-0.wav')) {
  let format;
  const parts = captions.map((caption, index) => {
    const wav = readFileSync(`public/media/part-${index}.wav`);
    let offset = 12;
    let data;
    while (offset + 8 <= wav.length) {
      const name = wav.toString('ascii', offset, offset + 4);
      const size = wav.readUInt32LE(offset + 4);
      if (name === 'fmt ') format = wav.subarray(offset + 8, offset + 8 + size);
      if (name === 'data') data = wav.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + (size % 2);
    }
    if (!data || !format) throw new Error('Invalid demo WAV');
    return { caption, data, duration: data.length / format.readUInt32LE(8) };
  });
  const combined = Buffer.concat(parts.map(part => part.data));
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + combined.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); format.copy(header, 20, 0, 16);
  header.write('data', 36); header.writeUInt32LE(combined.length, 40);
  writeFileSync('public/media/tree-story.wav', Buffer.concat([header, combined]));
  let cursor = 0;
  const timeline = parts.map(part => {
    const cue = { startTime: cursor, endTime: cursor + part.duration, caption: part.caption };
    cursor += part.duration;
    return cue;
  });
  writeFileSync('src/data/demoNarration.json', JSON.stringify(timeline, null, 2) + '\n');
  parts.forEach((_, index) => unlinkSync(`public/media/part-${index}.wav`));
}

const palettes = {
  '5-9': ['#f4c989', '#f8dfab', '#eaa262', '#7d9563', '#566b42', '#b05c39', '#e9b34c'],
  '10-13': ['#e8ad72', '#f3d1a0', '#cf8254', '#6f7957', '#424e3c', '#8d4733', '#efc45c'],
  '14-17': ['#bd966f', '#dec6a4', '#a67152', '#4d635a', '#293f3b', '#704334', '#e7b85d'],
  '18-plus': ['#a18c77', '#d4b895', '#906b51', '#4c5a50', '#293a36', '#634034', '#ddb264'],
};
for (const [tier, [sky, light, hills, foliage, dark, trunk, gold]] of Object.entries(palettes)) {
  for (let scene = 0; scene < 4; scene++) {
    const river = scene === 1 || scene === 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${light}"/></linearGradient><linearGradient id="water" x2="1" y2="1"><stop stop-color="#b0b6a2"/><stop offset="1" stop-color="#647d75"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
<g filter="url(#grain)"><path fill="url(#sky)" d="M0 0h1400v1000H0z"/><circle cx="1030" cy="230" r="105" fill="${light}" opacity=".85"/>
<path d="M0 580Q180 390 410 540T870 510T1400 470V1000H0Z" fill="${hills}" opacity=".55"/><path d="M0 680Q300 500 600 650T1400 590V1000H0Z" fill="${foliage}" opacity=".65"/>
${river ? '<path d="M1080 580Q670 720 900 810Q1120 900 570 1000H1390Q1390 820 1050 760Q850 700 1240 580Z" fill="url(#water)"/><path d="M1060 684l140 5m-200 48l100 4m-140 107l160 7m-100 48l150 3" stroke="#e3d8b8" stroke-width="5" opacity=".5"/>' : '<path d="M880 660Q500 820 650 1000H950Q660 830 940 670Z" fill="#d8b28b" opacity=".75"/>'}
<path d="M-100 1000V910Q220 800 460 880T900 900T1500 850V1000Z" fill="${dark}" opacity=".55"/>
<path d="M320 860Q415 630 390 360L470 330Q450 640 520 865L435 840Z" fill="${trunk}"/>
<path d="M423 590Q280 450 200 400M437 510Q590 440 680 320M425 440Q340 300 350 220M447 410Q510 310 515 190" fill="none" stroke="${trunk}" stroke-width="35" stroke-linecap="round"/>
<path d="M110 410Q-15 280 140 235Q80 100 265 140Q270 40 410 105Q500 20 605 135Q770 100 765 240Q870 350 710 390Q630 480 510 405Q350 500 260 420Q170 480 110 410Z" fill="${foliage}"/>
<path d="M80 300Q180 180 320 245Q395 120 535 235Q690 160 755 300Q590 260 495 340Q280 290 185 380Z" fill="${dark}" opacity=".3"/>
<path d="M200 205q45-35 80-7m130-40q48-16 70 12m100 100q55-30 83-4" fill="none" stroke="${light}" stroke-width="12" opacity=".25" stroke-linecap="round"/>
<g transform="translate(${river ? 805 : 630} ${river ? 725 : 765})"><circle cy="-66" r="23" fill="#4f332b"/><path d="M-20-42Q-42 5-45 55H43Q36 1 20-42Z" fill="${gold}"/><path d="M-19-8l-28 35m66-35l22 24" stroke="#4f332b" stroke-width="10" stroke-linecap="round"/><path d="M-20 56l-6 47m44-47l15 47" stroke="#4f332b" stroke-width="12" stroke-linecap="round"/><path d="M-25-71Q-26-104 0-101Q29-101 26-67Q5-81-25-71" fill="#302b27"/></g>
${scene === 2 ? '<g transform="translate(1000 720)"><circle cy="-75" r="24" fill="#503a2f"/><path d="M-20-50Q-40 5-55 67H50Q35 5 20-50Z" fill="#a34f3c"/><path d="M-24-79Q-26-110 0-110Q30-109 27-74" fill="#e7ce99"/><ellipse cx="-47" cy="30" rx="30" ry="19" fill="#ab8754"/></g>' : ''}
<g transform="translate(${river ? 1140 : 860} ${river ? 430 : 335})"><path d="M-40 10Q-10-20 20 0Q45-40 62-36Q48 4 20 17Q-4 34-40 10Z" fill="${gold}"/><path d="M-31 9l-28-13 15 25" fill="${gold}"/><circle cx="21" cy="4" r="3" fill="${dark}"/></g>
<g fill="${gold}" opacity=".6"><circle cx="180" cy="850" r="4"/><circle cx="1200" cy="640" r="4"/><circle cx="1090" cy="510" r="3"/><circle cx="545" cy="695" r="3"/></g>
<g stroke="${dark}" stroke-width="4" opacity=".5"><path d="M80 1000l-9-75m9 40l25-30m-25 10l-26-23M1230 1000l20-90m-11 48l-23-31m23 15l28-15M1150 1000l-5-56"/></g></g></svg>`;
    writeFileSync(`public/media/${tier}-scene-${scene}.svg`, svg);
  }
}
writeFileSync('public/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#D97706"/><g stroke="#0F172A" stroke-width="5" stroke-linecap="round"><path d="M18 27v10M27 19v26M36 15v34M45 24v16"/></g></svg>');
console.log('Oralia local demo media ready.');
