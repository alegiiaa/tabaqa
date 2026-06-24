// Intentionally empty. The landing page ships its own hand-written CSS and does
// NOT use Tailwind. This local (plugin-less) config stops PostCSS from walking up
// the directory tree and picking up an unrelated Tailwind config in a parent
// folder, which would otherwise inject Tailwind's preflight reset.
export default {
  plugins: {},
}
