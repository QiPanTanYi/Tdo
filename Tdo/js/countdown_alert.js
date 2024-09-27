document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const taskName = urlParams.get('taskName');
    const deadline = urlParams.get('deadline');


    document.getElementById('taskName').textContent = `任务名称: ${taskName}`;
    document.getElementById('deadline').textContent = `截止时间: ${deadline}`;
    
    // 播放音频

    const audio = new Audio(chrome.runtime.getURL('music/Ringing.mp3'));
    audio.play().catch(error => console.error('Error playing audio:', error));
});