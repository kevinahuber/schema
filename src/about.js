export function renderAbout(container) {
  const section = document.createElement('section');
  section.className = 'page-about';
  section.setAttribute('aria-labelledby', 'about-title');

  section.innerHTML = `
    <h1 id="about-title" class="page-title">About</h1>
    <div class="about-body">
      <p>
        Every drawing you make here is yours — your gesture, your color, your mark.
        But the canvas is not. The size is fixed. The palette is chosen. The brush
        is constrained. You are doodling freely inside a frame you didn't build,
        and the mosaic that emerges is one you'll never fully see while you're
        making it. This is how algorithmic feeds work. We post, share, and create
        believing we are expressing ourselves independently, when in reality we are
        conforming to formats laid out by the platforms — aspect ratios, compression
        quality, character limits, duration caps — all engineered to serve a larger
        picture that was never ours to compose.
      </p>
      <p>
        Protest, beauty, joy, and grief all pass through the same machine, reshaped
        to fit the algorithm's original intention. schema makes that invisible
        architecture visible. Each doodle is an act of genuine expression; the
        mosaic is what the system makes of it. Whether you see constraint or
        collaboration in that tension is up to you.
      </p>
      <p class="about-cta">
        Want a mosaic installation — physical or digital — at your venue, event, or
        public space? <a href="https://kevcreates.art/contact" class="about-link">Get in touch</a>.
      </p>
      <p class="about-credit">
        A project by <a href="https://kevcreates.art" class="about-link">kevcreates.art</a>
      </p>
    </div>
  `;

  container.appendChild(section);
  return null;
}
