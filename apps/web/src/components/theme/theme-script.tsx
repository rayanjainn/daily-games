/**
 * Applies the saved theme and motion preference before first paint (no flash).
 * Values: localStorage `ed-theme` = light | dark | system, `ed-motion` = reduced | system.
 */
const code = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('ed-theme');if(t==='light'||t==='dark'){d.dataset.theme=t}var m=localStorage.getItem('ed-motion');if(m==='reduced'){d.dataset.motion='reduced'}}catch(e){}})();`;

export function ThemeScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}
