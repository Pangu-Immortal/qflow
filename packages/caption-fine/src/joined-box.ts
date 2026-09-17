/**
 * Fine's joined decoration is measured after browser layout. Its temporary, untransformed copy
 * uses the same exact-font children and content width, so Cue motion cannot distort measurements.
 * Nothing is retained outside the program or written back into Script/Caption/Timeline.
 */
export const joinedBoxSetup = String.raw`
const layout = root.querySelector('[data-fine-box-layout]');
const layers = [...root.querySelectorAll('[data-caption-active-box="joined"]')];
const ns = 'http://www.w3.org/2000/svg';
const paths = layers.map(layer => {
  const svg = document.createElementNS(ns, 'svg');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', data.background);
  path.setAttribute('stroke', data.borderColor);
  path.setAttribute('stroke-width', String(data.borderWidth));
  svg.append(path); layer.append(svg); return path;
});
// Union on actual rectangle edges. Tracing only the exterior removes internal borders and
// paints translucent fills once, including where line padding overlaps the neighbouring line.
const outline = rectangles => {
  const xs = [...new Set(rectangles.flatMap(r => [r.left, r.right]))].sort((a,b) => a-b);
  const ys = [...new Set(rectangles.flatMap(r => [r.top, r.bottom]))].sort((a,b) => a-b);
  const cells = ys.slice(1).map((_, y) => xs.slice(1).map((_, x) => rectangles.some(r =>
    r.left <= xs[x] && r.right >= xs[x+1] && r.top <= ys[y] && r.bottom >= ys[y+1])));
  const edges = new Map();
  const key = (x,y) => x+','+y;
  const add = (x,y,ex,ey) => {
    const k = key(x,y), list = edges.get(k) || [];
    list.push([ex,ey]); edges.set(k,list);
  };
  for (let y=0;y<cells.length;y++) for (let x=0;x<cells[y].length;x++) {
    if (!cells[y][x]) continue;
    if (!cells[y-1]?.[x]) add(x,y,x+1,y);
    if (!cells[y]?.[x+1]) add(x+1,y,x+1,y+1);
    if (!cells[y+1]?.[x]) add(x+1,y+1,x,y+1);
    if (!cells[y]?.[x-1]) add(x,y+1,x,y);
  }
  const contours = [];
  while (edges.size) {
    const start = edges.keys().next().value.split(',').map(Number);
    const points = []; let current = start, previous;
    do {
      points.push([xs[current[0]],ys[current[1]]]);
      const k = key(...current), next = edges.get(k);
      let index = 0;
      if (next.length > 1 && previous) {
        const dx = current[0]-previous[0], dy = current[1]-previous[1];
        // At a point contact, keep each contour on its own side of the corner.
        index = next.findIndex(p => dx*(p[1]-current[1])-dy*(p[0]-current[0]) > 0);
        if (index < 0) index = 0;
      }
      const target = next.splice(index,1)[0];
      if (!next.length) edges.delete(k);
      previous = current; current = target;
    } while (current[0] !== start[0] || current[1] !== start[1]);
    const corners = points.filter((p,i) => {
      const a = points[(i+points.length-1)%points.length], b = points[(i+1)%points.length];
      return (p[0]-a[0])*(b[1]-p[1]) !== (p[1]-a[1])*(b[0]-p[0]);
    });
    const rounded = corners.map((p,i) => {
      const a = corners[(i+corners.length-1)%corners.length], b = corners[(i+1)%corners.length];
      const before = Math.hypot(p[0]-a[0],p[1]-a[1]), after = Math.hypot(b[0]-p[0],b[1]-p[1]);
      const radius = Math.min(data.radius, before/2, after/2);
      return { p, start: [p[0]+(a[0]-p[0])*radius/before,p[1]+(a[1]-p[1])*radius/before],
        end: [p[0]+(b[0]-p[0])*radius/after,p[1]+(b[1]-p[1])*radius/after], radius,
        turn: (p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]) };
    });
    contours.push(rounded.map((c,i) => (i ? 'L' : 'M')+c.start.join(' ')
      +(c.radius ? 'A'+c.radius+' '+c.radius+' 0 0 '+(c.turn>0 ? 1 : 0)+' '+c.end.join(' ') : '')).join(' ')+'Z');
  }
  return contours.join(' ');
};
return () => {
  const measure = layout.cloneNode(true);
  // Exact font declarations are already inline on the typed text children. Copy the inherited
  // flow properties explicitly; the measurement must not inherit the document body's typography.
  const style = getComputedStyle(layout);
  const rootStyle = getComputedStyle(root);
  const offsetX = parseFloat(rootStyle.paddingLeft), offsetY = parseFloat(rootStyle.paddingTop);
  for (const name of ['font-size','line-height','text-align','direction','letter-spacing','word-spacing']) {
    measure.style.setProperty(name,style.getPropertyValue(name));
  }
  measure.style.cssText += ';position:fixed;left:0;top:0;margin:0;padding:0;border:0;box-sizing:content-box;'
    +'width:'+style.width+';height:auto;max-width:none;transform:none;visibility:hidden;pointer-events:none';
  measure.removeAttribute('id');
  for (const child of measure.querySelectorAll('[id]')) child.removeAttribute('id');
  document.body.append(measure);
  let words;
  try {
    const origin = measure.getBoundingClientRect();
    words = [...measure.querySelectorAll('[data-fine-box-word]')].map(word => {
      const range = document.createRange(); range.selectNodeContents(word);
      return [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => ({
        left:r.left-origin.left+offsetX, right:r.right-origin.left+offsetX,
        top:r.top-origin.top+offsetY, bottom:r.bottom-origin.top+offsetY,
      }));
    });
  } finally { measure.remove(); }
  const lines = new Map(); let wordIndex = 0;
  for (let index=0;index<paths.length;index++) {
    for (let count=0;count<data.wordCounts[index];count++) for (const rect of words[wordIndex++]) {
      const line = lines.get(rect.top);
      if (!line) lines.set(rect.top,{...rect});
      else { line.left=Math.min(line.left,rect.left); line.right=Math.max(line.right,rect.right);
        line.bottom=Math.max(line.bottom,rect.bottom); }
    }
    paths[index].setAttribute('d',outline([...lines.values()].map(r => ({
      left:r.left-data.paddingX-data.borderWidth/2, right:r.right+data.paddingX+data.borderWidth/2,
      top:r.top-data.paddingY-data.borderWidth/2, bottom:r.bottom+data.paddingY+data.borderWidth/2,
    }))));
  }
};
`;
