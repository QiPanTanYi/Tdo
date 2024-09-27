// background.js

let tasks = [];

// 从 IndexedDB 加载任务
function loadTasks() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TodoDB', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const getAll = store.getAll();

      getAll.onsuccess = function(event) {
        tasks = event.target.result;
        resolve(tasks);
      };
    };

    request.onerror = function(event) {
      reject("Error loading tasks: " + event.target.error);
    };
  });
}

// 检查倒计时并触发提醒
function checkCountdowns() {
  loadTasks().then(() => {
    const now = new Date();
    tasks.forEach(task => {
      const deadline = new Date(task.deadline);
      const diff = deadline - now;

      if (diff <= 2000 && diff > 1000) {  // 2秒到1秒之间
        chrome.windows.create({
          url: `html/countdown_alert.html?taskName=${encodeURIComponent(task.name)}&deadline=${encodeURIComponent(task.deadline)}`,
          type: "popup",
          width: 396,
          height: 321
        }, (window) => {
          // 提示音
          chrome.tabs.sendMessage(window.tabs[0].id, {action: "playSound"});
        });
      }
    });
  });
}

// 设置定期检查的闹钟
function setupAlarm() {
  chrome.alarms.create('checkCountdowns', { periodInMinutes: 1 / 60 }); // 每秒检查一次
}

// 监听闹钟事件
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkCountdowns') {
    checkCountdowns();
  }
});

// 监听来自 app.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "taskUpdated") {
    loadTasks();  // 重新加载任务
  } else if (request.action === "createNotification") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("images/favicon-32x32.png"),
      title: "任务提醒",
      message: request.message
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Notification error: ", chrome.runtime.lastError.message);
      }
    });
  } else if (request.action === "countdownAlert") {
    chrome.windows.create({
      url: `html/countdown_alert.html?taskName=${encodeURIComponent(request.taskName)}&deadline=${encodeURIComponent(request.deadline)}`,
      type: "popup",
      width: 300,
      height: 200
    });
  }
});

// 初始化
loadTasks().then(() => {
  setupAlarm();
});