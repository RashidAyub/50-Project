const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function renderTasks() {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    taskList.innerHTML = '<li class="empty">No tasks yet. Add one above!</li>';
    return;
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const item = document.createElement('li');

    if (task.completed) {
      item.className = 'completed';
    }

    item.innerHTML = '<span class="task-text">' + task.text + '</span>';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const doneBtn = document.createElement('button');
    doneBtn.textContent = task.completed ? 'Undo' : 'Done';
    doneBtn.onclick = function () {
      tasks[i].completed = !tasks[i].completed;
      saveTasks();
      renderTasks();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = function () {
      tasks.splice(i, 1);
      saveTasks();
      renderTasks();
    };

    actions.appendChild(doneBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    taskList.appendChild(item);
  }
}

function addTask() {
  const text = taskInput.value.trim();

  if (text !== '') {
    tasks.unshift({ text: text, completed: false });
    taskInput.value = '';
    saveTasks();
    renderTasks();
  }
}

addBtn.onclick = addTask;

taskInput.onkeydown = function (event) {
  if (event.key === 'Enter') {
    addTask();
  }
};

renderTasks();
