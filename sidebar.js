document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    
    let isVisible = false;
    
    function toggleSidebar() {
        isVisible = !isVisible;
        
        if (isVisible) {
            sidebar.classList.add('visible');
            toggleBtn.classList.add('visible');
            toggleBtn.textContent = '×'; // 改为关闭符号
            toggleBtn.style.fontSize = '16px'; // 展开时稍大一点
        } else {
            sidebar.classList.remove('visible');
            toggleBtn.classList.remove('visible');
            toggleBtn.textContent = '☰'; // 改为菜单图标
            toggleBtn.style.fontSize = '12px'; // 收缩时小一点
        }
    }
    
    toggleBtn.addEventListener('click', toggleSidebar);
    
    // 初始状态
    toggleBtn.textContent = '☰';
});