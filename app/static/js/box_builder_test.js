// Minimal test version of box_builder.js
console.log('[TEST] Script loaded');

(function(){
  console.log('[TEST] IIFE executing');
  
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[TEST] DOMContentLoaded fired');
    
    const root = document.getElementById('lm-root');
    console.log('[TEST] Root element:', root);
    
    if(!root) {
      console.error('[TEST] ERROR: No element with id="lm-root" found!');
      return;
    }
    
    const form = root.querySelector('form.box-lm-form');
    console.log('[TEST] Form element:', form);
    
    if(!form) {
      console.error('[TEST] ERROR: No form with class="box-lm-form" found!');
      return;
    }
    
    console.log('[TEST] All elements found successfully!');
    
    // Hide spinner
    const spinner = document.getElementById('builder-spinner');
    if(spinner){
      console.log('[TEST] Hiding spinner');
      spinner.classList.add('is-hide');
      setTimeout(()=>{ 
        try { 
          spinner.remove(); 
          console.log('[TEST] Spinner removed');
        } catch(e){ 
          console.error('[TEST] Error removing spinner:', e);
        } 
      }, 120);
    } else {
      console.warn('[TEST] No spinner element found');
    }
    
    // Enable controls
    const disabledElements = form.querySelectorAll('input[disabled],select[disabled],button[disabled]');
    console.log('[TEST] Enabling', disabledElements.length, 'disabled elements');
    disabledElements.forEach(el=>el.removeAttribute('disabled'));
    
    // Simple test: add event listener to first input
    const firstInput = form.querySelector('input[type="number"]');
    if(firstInput) {
      console.log('[TEST] Adding event listener to first input');
      firstInput.addEventListener('input', (e) => {
        console.log('[TEST] Input changed:', e.target.value);
      });
    }
    
    console.log('[TEST] Initialization complete!');
  });
  
  console.log('[TEST] Event listener registered, waiting for DOM...');
})();

console.log('[TEST] Script end reached');
