'use strict';

const playButton = document.getElementById('playSelectedVideo');
const videoIdSelect = document.getElementById('theSelect');
const playgroundDiv = document.getElementById('playground');

playButton.addEventListener('click', () => startVideo(videoIdSelect.value));

function startVideo(id) {
  const url = `/play/${id}`;
  fetch(url).then(x => x.text()).then(html => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('width', '100%');
    playgroundDiv.innerHTML = '';
    playgroundDiv.appendChild(iframe);
    iframe.onload = () => {
      iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
    };
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
  });
}
