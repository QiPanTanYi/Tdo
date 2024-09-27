// js/app.js
let db;
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TodoDB', 1);

    request.onupgradeneeded = function(event) {
      db = event.target.result;
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = function(event) {
      db = event.target.result;
      console.log("IndexedDB 初始化成功");
      resolve();
    };

    request.onerror = function(event) {
      console.log("IndexedDB 初始化失败: ", event);
      reject(event);
    };
  });
}
let tasks = [];
// 获取 modal 和按钮元素
const modal = document.getElementById('taskModal');
const addTaskBtn = document.getElementById('addTaskBtn');
const closeModalBtn = document.getElementsByClassName('close')[0];
const saveTaskBtn = document.getElementById('saveTaskBtn');

// 添加任务按钮，点击后弹出弹窗
addTaskBtn.onclick = function() {
  modal.style.display = 'block'; // 显示弹窗
};

// 关闭弹窗的逻辑
closeModalBtn.onclick = function() {
  modal.style.display = 'none'; // 点击关闭按钮时隐藏弹窗
};

// 点击窗体外部区域关闭弹窗
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = 'none'; // 当点击的对象是弹窗背景时关闭弹窗
  }
};

// 保存任务
saveTaskBtn.onclick = function() {
  const taskName = document.getElementById('taskName').value;
  const deadline = document.getElementById('deadline').value;

  if (taskName && deadline) {
    const newTask = { name: taskName, deadline: deadline };
    addTaskToDB(newTask);  // 将任务添加到 IndexedDB
    modal.style.display = 'none';  // 任务保存后关闭弹窗
  }
};
// 打开 IndexedDB 数据库
const request = indexedDB.open('TodoDB', 1);

request.onupgradeneeded = function(event) {
  db = event.target.result;
  if (!db.objectStoreNames.contains('tasks')) {
    db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
  }
};

request.onsuccess = function(event) {
  db = event.target.result;
  console.log("IndexedDB 初始化成功");
  loadTasks();  // 页面加载时读取任务
};

request.onerror = function(event) {
  console.log("IndexedDB 初始化失败: ", event);
};

// 从 IndexedDB 加载任务
function loadTasks() {
  if (!db) {
    console.log("数据库未初始化，正在尝试初始化...");
    return initDB().then(() => {
      return loadTasksFromDB();
    }).catch(error => {
      console.error("数据库初始化失败:", error);
    });
  }
  return loadTasksFromDB();
}

function loadTasksFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.getAll();

    request.onsuccess = function(event) {
      tasks = event.target.result;
      renderTasks();
      resolve(tasks);
    };

    request.onerror = function(event) {
      console.log("任务加载失败: ", event);
      reject(event);
    };
  });
}

// 保存任务到 IndexedDB
function addTaskToDB(task) {
  const transaction = db.transaction(['tasks'], 'readwrite');
  const store = transaction.objectStore('tasks');
  store.add(task);

  transaction.oncomplete = function() {
    console.log("任务已添加到 IndexedDB");
    loadTasks();  // 重新加载任务
    chrome.runtime.sendMessage({action: "taskUpdated"});  // 通知后台脚本
  };

  transaction.onerror = function(event) {
    console.log("任务添加失败: ", event);
  };
}

// 删除任务从 IndexedDB
function deleteTaskFromDB(taskId) {
  const transaction = db.transaction(['tasks'], 'readwrite');
  const store = transaction.objectStore('tasks');
  store.delete(taskId);

  transaction.oncomplete = function() {
    console.log("任务已从 IndexedDB 删除");
    loadTasks();  // 删除后重新加载任务
    chrome.runtime.sendMessage({action: "taskUpdated"});  // 通知后台脚本
  };

  transaction.onerror = function(event) {
    console.log("任务删除失败: ", event);
  };
}

// 渲染任务列表
function renderTasks() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = ''; // 清空现有的任务列表

  tasks.forEach((task) => {
    const listItem = document.createElement('div');
    listItem.classList.add('list');
    
    const content = document.createElement('div');
    content.classList.add('content');
    const title = document.createElement('h2');

    // 强制每 15 个字符换行
    const formattedTitle = task.name.match(/.{1,15}/g).join('\n');
    title.textContent = formattedTitle;

    // 创建一个倒计时的 p 元素
    const countdown = document.createElement('h3');
    countdown.id = `countdown-${task.id}`;
    
    content.appendChild(title);
    content.appendChild(countdown);
    listItem.appendChild(content);

    // 添加删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM17 4v-1c0-.55-.45-1-1-1h-2c-.55 0-1 .45-1 1v1H7v2h14V4h-4zm-2 2H9v-2h6v2z" fill="white"/>
      </svg>`;
    deleteButton.onclick = function() {
      deleteTaskFromDB(task.id);  // 删除该任务
    };
    listItem.appendChild(deleteButton);

    taskList.appendChild(listItem);

    // 立即设置倒计时
    updateCountdown(task.id, task.deadline, task.name);
  });
}


function updateCountdown(taskId, deadline, taskName) {
  const countdownElement = document.getElementById(`countdown-${taskId}`);

  // 计算并立即显示倒计时
  const countdownText = calculateCountdown(deadline);
  countdownElement.textContent = countdownText;

  // 每秒更新一次倒计时
  const intervalId = setInterval(function() {
    const updatedCountdownText = calculateCountdown(deadline);
    countdownElement.textContent = updatedCountdownText;

    // 如果倒计时从2秒变为1秒，触发浏览器弹窗
    if (updatedCountdownText === '0天 0小时 0分钟 2秒') {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "countdownAlert",
          taskName: taskName,
          deadline: deadline
        });
      }, 1000);
    }

    // 如果倒计时结束，停止定时器
    if (updatedCountdownText === '已过期') {
      clearInterval(intervalId);
    }
  }, 1000); // 每秒更新一次
}


// 计算倒计时
function calculateCountdown(deadline) {
  const end = new Date(deadline);
  const now = new Date();
  const diff = end - now;
  
  if (diff <= 0) return '已过期';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;
}


// 添加任务
saveTaskBtn.onclick = function() {
  const taskName = document.getElementById('taskName').value;
  const deadline = document.getElementById('deadline').value;

  if (taskName && deadline) {
    const newTask = { name: taskName, deadline: deadline };
    addTaskToDB(newTask);  // 将任务添加到 IndexedDB
    modal.style.display = 'none';
  }
}

// 显示当前时间
let lastUpdateTime = 0;
function updateTime(timestamp) {
  const now = new Date();
  
  if (timestamp - lastUpdateTime >= 1000) {
    const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    document.getElementById('current-date').textContent = date;
    document.getElementById('current-time').textContent = time;
    
    lastUpdateTime = timestamp;
  }

  requestAnimationFrame(updateTime);  // 进行下一次更新
}

window.onload = function() {
  updateTime();  // 页面加载时立即显示当前时间
  initDB().then(() => {
    return loadTasks();
  }).catch(error => {
    console.error("初始化或加载任务失败:", error);
  });
}

