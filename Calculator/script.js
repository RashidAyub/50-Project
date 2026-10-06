/**
 * ============================================================================
 * AeroCalc Pro — Modern JavaScript Calculator Logic
 * Pure Vanilla JavaScript (ES6+), No external dependencies, No eval()
 * ============================================================================
 * Features:
 *  - Accurate floating point arithmetic
 *  - Division by zero handling
 *  - Consecutive operator replacement
 *  - Calculation history with localStorage persistence
 *  - Dark / Light theme toggle with memory
 *  - Web Audio API haptic synthetic click audio
 *  - Copy to clipboard with toast notifications
 *  - Full keyboard shortcuts & visual keypress feedback
 *  - Number formatting with comma separators
 * ============================================================================
 */

'use strict';

class Calculator {
  constructor(previousOperandTextElement, currentOperandTextElement) {
    this.previousOperandTextElement = previousOperandTextElement;
    this.currentOperandTextElement = currentOperandTextElement;
    this.history = this.loadHistory();
    this.isSoundEnabled = localStorage.getItem('aerocalc_sound') !== 'false';
    this.audioContext = null;
    this.clear();
  }

  /**
   * Resets the current calculation state to initial values.
   */
  clear() {
    this.currentOperand = '0';
    this.previousOperand = '';
    this.operation = undefined;
    this.shouldResetScreen = false;
    this.hasError = false;
    this.removeActiveOperatorHighlight();
  }

  /**
   * Deletes the last character from current input.
   */
  delete() {
    if (this.hasError) {
      this.clear();
      return;
    }
    if (this.shouldResetScreen) {
      this.currentOperand = '0';
      this.shouldResetScreen = false;
      return;
    }
    if (this.currentOperand.length === 1 || this.currentOperand === '-0') {
      this.currentOperand = '0';
    } else {
      this.currentOperand = this.currentOperand.slice(0, -1);
      // Clean up standalone minus sign
      if (this.currentOperand === '-') {
        this.currentOperand = '0';
      }
    }
  }

  /**
   * Appends a digit or decimal point to current operand.
   * @param {string} number - The digit or '.' to append.
   */
  appendNumber(number) {
    if (this.hasError) {
      this.clear();
    }

    if (this.shouldResetScreen) {
      this.currentOperand = '';
      this.shouldResetScreen = false;
    }

    // Prevent multiple decimal points
    if (number === '.' && this.currentOperand.includes('.')) {
      return;
    }

    // Default 0 replacement unless decimal
    if (this.currentOperand === '0' && number !== '.') {
      this.currentOperand = number;
      return;
    }

    // Avoid multiple leading zeros
    if (this.currentOperand === '0' && number === '0') {
      return;
    }

    // Limit maximum length to prevent visual overflow
    if (this.currentOperand.replace(/[^0-9]/g, '').length >= 16) {
      return;
    }

    this.currentOperand += number;
    this.removeActiveOperatorHighlight();
  }

  /**
   * Toggles positive/negative sign of current operand.
   */
  toggleSign() {
    if (this.hasError || this.currentOperand === '0') return;

    if (this.currentOperand.startsWith('-')) {
      this.currentOperand = this.currentOperand.slice(1);
    } else {
      this.currentOperand = '-' + this.currentOperand;
    }
  }

  /**
   * Calculates percentage based on context.
   */
  applyPercent() {
    if (this.hasError) return;

    const current = parseFloat(this.currentOperand);
    if (isNaN(current)) return;

    let result;
    if (this.previousOperand !== '' && this.operation) {
      const prev = parseFloat(this.previousOperand);
      // If adding/subtracting percentage (e.g. 100 + 10% = 110)
      if (this.operation === '+' || this.operation === '-') {
        result = (prev * current) / 100;
      } else {
        result = current / 100;
      }
    } else {
      result = current / 100;
    }

    this.currentOperand = this.formatCalculatedResult(result).toString();
    this.shouldResetScreen = true;
  }

  /**
   * Selects an arithmetic operator (+, -, ×, ÷).
   * Supports changing operator consecutively without computing.
   * @param {string} operation - The selected operation.
   */
  chooseOperation(operation) {
    if (this.hasError) {
      this.clear();
    }

    // If operator clicked consecutively without entering new number, simply change the operator
    if (this.currentOperand === '' && this.previousOperand !== '') {
      this.operation = operation;
      this.highlightActiveOperator(operation);
      return;
    }

    // If there is already a previous operand, compute intermediate result
    if (this.previousOperand !== '') {
      this.compute(false);
      if (this.hasError) return;
    }

    this.operation = operation;
    this.previousOperand = this.currentOperand;
    this.currentOperand = '';
    this.highlightActiveOperator(operation);
  }

  /**
   * Executes calculation with precision and error boundaries.
   * @param {boolean} recordHistory - Whether to append to history log.
   */
  compute(recordHistory = true) {
    let computation;
    const prev = parseFloat(this.previousOperand);
    const current = parseFloat(this.currentOperand);

    // If either operand is invalid, do nothing
    if (isNaN(prev) || isNaN(current)) return;

    switch (this.operation) {
      case '+':
        computation = prev + current;
        break;
      case '-':
        computation = prev - current;
        break;
      case '×':
      case '*':
        computation = prev * current;
        break;
      case '÷':
      case '/':
        if (current === 0) {
          this.triggerDivisionByZeroError();
          return;
        }
        computation = prev / current;
        break;
      default:
        return;
    }

    const formattedResult = this.formatCalculatedResult(computation);
    const equation = `${this.formatDisplayNumber(prev)} ${this.operation} ${this.formatDisplayNumber(current)}`;

    if (recordHistory) {
      this.addHistoryItem(equation, formattedResult);
    }

    this.currentOperand = formattedResult.toString();
    this.operation = undefined;
    this.previousOperand = '';
    this.shouldResetScreen = true;
    this.removeActiveOperatorHighlight();
  }

  /**
   * Handles division by zero gracefully.
   */
  triggerDivisionByZeroError() {
    this.hasError = true;
    this.currentOperand = 'Cannot divide by 0';
    this.previousOperand = '';
    this.operation = undefined;
    this.removeActiveOperatorHighlight();
  }

  /**
   * Solves floating-point precision quirks (e.g. 0.1 + 0.2 = 0.3)
   * and limits precision to prevent exponential overflows.
   * @param {number} num - The floating number.
   * @returns {number} Normalized rounded number.
   */
  formatCalculatedResult(num) {
    if (!isFinite(num)) {
      return 0;
    }
    // Round to 12 decimal places to eliminate IEEE 754 precision noise
    const factor = 1e12;
    const rounded = Math.round(num * factor) / factor;
    return rounded;
  }

  /**
   * Formats a raw number or string with standard thousand commas.
   * @param {string|number} number - Value to format.
   * @returns {string} Formatted number string.
   */
  formatDisplayNumber(number) {
    if (number === undefined || number === null || number === '') return '';
    if (this.hasError) return number.toString();

    const stringNumber = number.toString();
    const integerDigits = parseFloat(stringNumber.split('.')[0]);
    const decimalDigits = stringNumber.split('.')[1];

    let integerDisplay;
    if (isNaN(integerDigits)) {
      integerDisplay = stringNumber.startsWith('-') ? '-' : '';
    } else {
      integerDisplay = integerDigits.toLocaleString('en', {
        maximumFractionDigits: 0
      });
    }

    if (decimalDigits != null) {
      return `${integerDisplay}.${decimalDigits}`;
    } else {
      return integerDisplay;
    }
  }

  /**
   * Visual indicator on the active operator button.
   * @param {string} op - The operator character.
   */
  highlightActiveOperator(op) {
    this.removeActiveOperatorHighlight();
    const operatorButtons = document.querySelectorAll('.btn-operator');
    operatorButtons.forEach(btn => {
      if (btn.dataset.operator === op) {
        btn.classList.add('is-active-operator');
      }
    });
  }

  /**
   * Clears active operator highlights.
   */
  removeActiveOperatorHighlight() {
    document.querySelectorAll('.btn-operator').forEach(btn => {
      btn.classList.remove('is-active-operator');
    });
  }

  /**
   * Updates display elements and adjusts font sizing for long numbers.
   */
  updateDisplay() {
    if (this.hasError) {
      this.currentOperandTextElement.innerText = this.currentOperand;
      this.currentOperandTextElement.classList.add('error-state');
      this.previousOperandTextElement.innerText = '';
      return;
    }

    this.currentOperandTextElement.classList.remove('error-state');
    this.currentOperandTextElement.innerText = this.formatDisplayNumber(this.currentOperand);

    if (this.operation != null) {
      this.previousOperandTextElement.innerText = 
        `${this.formatDisplayNumber(this.previousOperand)} ${this.operation}`;
    } else {
      this.previousOperandTextElement.innerText = '';
    }

    // Auto-scale font size depending on length
    const displayLen = this.currentOperand.length;
    this.currentOperandTextElement.classList.remove('compact-text', 'compact-small');
    if (displayLen > 14) {
      this.currentOperandTextElement.classList.add('compact-small');
    } else if (displayLen > 9) {
      this.currentOperandTextElement.classList.add('compact-text');
    }
  }

  /* ------------------------------------------------------------------------
     Calculation History System
     ------------------------------------------------------------------------ */
  loadHistory() {
    try {
      const stored = localStorage.getItem('aerocalc_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Unable to access localStorage for history:', e);
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('aerocalc_history', JSON.stringify(this.history));
    } catch (e) {
      console.warn('Unable to save history to localStorage:', e);
    }
    this.renderHistory();
  }

  addHistoryItem(expression, result) {
    const item = {
      id: Date.now(),
      expression: expression,
      result: result.toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    // Keep up to 30 history items
    this.history.unshift(item);
    if (this.history.length > 30) {
      this.history.pop();
    }
    this.saveHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  renderHistory() {
    const historyList = document.getElementById('history-list');
    const historyBadge = document.getElementById('history-badge');
    
    if (historyBadge) {
      historyBadge.innerText = this.history.length;
      if (this.history.length > 0) {
        historyBadge.style.display = 'flex';
      } else {
        historyBadge.style.display = 'none';
      }
    }

    if (!historyList) return;

    if (this.history.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p>No calculations yet</p>
          <span class="history-empty-sub">Your previous calculations will appear here.</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = '';
    this.history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Click to recall this result';
      card.innerHTML = `
        <div class="history-item-expression">${item.expression} =</div>
        <div class="history-item-result">${this.formatDisplayNumber(item.result)}</div>
      `;

      card.addEventListener('click', () => {
        this.recallHistoryValue(item.result);
        toggleHistoryPanel(false);
        showToast('Restored from history');
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          this.recallHistoryValue(item.result);
          toggleHistoryPanel(false);
          showToast('Restored from history');
        }
      });

      historyList.appendChild(card);
    });
  }

  recallHistoryValue(value) {
    this.currentOperand = value.toString();
    this.shouldResetScreen = true;
    this.hasError = false;
    this.updateDisplay();
  }

  /* ------------------------------------------------------------------------
     Web Audio API Feedback
     ------------------------------------------------------------------------ */
  playTone(frequency = 440, type = 'sine', duration = 0.04) {
    if (!this.isSoundEnabled) return;
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Audio not permitted or unsupported, fail silently
    }
  }

  playClick() {
    this.playTone(320, 'triangle', 0.035);
  }

  playOperator() {
    this.playTone(480, 'sine', 0.045);
  }

  playEquals() {
    this.playTone(680, 'triangle', 0.08);
  }

  playError() {
    this.playTone(180, 'sawtooth', 0.12);
  }
}

/* ==========================================================================
   DOM Elements & Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const previousOperandTextElement = document.getElementById('previous-operand');
  const currentOperandTextElement = document.getElementById('current-operand');
  const numberButtons = document.querySelectorAll('[data-number]');
  const operatorButtons = document.querySelectorAll('[data-operator]');
  const actionButtons = document.querySelectorAll('[data-action]');
  const copyBtn = document.getElementById('copy-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const shortcutsBtn = document.getElementById('shortcuts-btn');
  const shortcutsModal = document.getElementById('shortcuts-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const historyPanel = document.getElementById('history-panel');

  const calculator = new Calculator(previousOperandTextElement, currentOperandTextElement);
  calculator.updateDisplay();
  calculator.renderHistory();

  /* ------------------------------------------------------------------------
     Keypad Click Listeners
     ------------------------------------------------------------------------ */
  numberButtons.forEach(button => {
    button.addEventListener('click', () => {
      calculator.appendNumber(button.dataset.number);
      calculator.updateDisplay();
      calculator.playClick();
      animateButtonPress(button);
    });
  });

  operatorButtons.forEach(button => {
    button.addEventListener('click', () => {
      calculator.chooseOperation(button.dataset.operator);
      calculator.updateDisplay();
      calculator.playOperator();
      animateButtonPress(button);
    });
  });

  actionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      animateButtonPress(button);

      switch (action) {
        case 'clear':
          calculator.clear();
          calculator.updateDisplay();
          calculator.playClick();
          break;
        case 'delete':
          calculator.delete();
          calculator.updateDisplay();
          calculator.playClick();
          break;
        case 'percent':
          calculator.applyPercent();
          calculator.updateDisplay();
          calculator.playOperator();
          break;
        case 'toggle-sign':
          calculator.toggleSign();
          calculator.updateDisplay();
          calculator.playClick();
          break;
        case 'calculate':
          calculator.compute();
          calculator.updateDisplay();
          if (calculator.hasError) {
            calculator.playError();
          } else {
            calculator.playEquals();
          }
          break;
      }
    });
  });

  /* ------------------------------------------------------------------------
     Keyboard Event Handling
     ------------------------------------------------------------------------ */
  window.addEventListener('keydown', (e) => {
    // If modal is open, close with Esc
    if (!shortcutsModal.classList.contains('hide') && e.key === 'Escape') {
      shortcutsModal.classList.add('hide');
      return;
    }

    // Ignore if focus is in an input or contenteditable
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    // Copy result shortcut
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      handleCopyResult();
      return;
    }

    // Toggle history drawer
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleHistoryPanel();
      return;
    }

    // Show Shortcuts Modal
    if (e.key === '?') {
      e.preventDefault();
      shortcutsModal.classList.remove('hide');
      return;
    }

    // Numeric Digits (0 - 9)
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      calculator.appendNumber(e.key);
      calculator.updateDisplay();
      calculator.playClick();
      highlightKeyButton(`[data-number="${e.key}"]`);
      return;
    }

    // Decimal Point
    if (e.key === '.' || e.key === ',') {
      e.preventDefault();
      calculator.appendNumber('.');
      calculator.updateDisplay();
      calculator.playClick();
      highlightKeyButton('[data-number="."]');
      return;
    }

    // Basic Operators (+, -, *, /)
    if (e.key === '+') {
      e.preventDefault();
      calculator.chooseOperation('+');
      calculator.updateDisplay();
      calculator.playOperator();
      highlightKeyButton('[data-operator="+"]');
      return;
    }
    if (e.key === '-') {
      e.preventDefault();
      calculator.chooseOperation('-');
      calculator.updateDisplay();
      calculator.playOperator();
      highlightKeyButton('[data-operator="-"]');
      return;
    }
    if (e.key === '*' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      calculator.chooseOperation('×');
      calculator.updateDisplay();
      calculator.playOperator();
      highlightKeyButton('[data-operator="×"]');
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      calculator.chooseOperation('÷');
      calculator.updateDisplay();
      calculator.playOperator();
      highlightKeyButton('[data-operator="÷"]');
      return;
    }

    // Equals (Enter or =)
    if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      calculator.compute();
      calculator.updateDisplay();
      if (calculator.hasError) {
        calculator.playError();
      } else {
        calculator.playEquals();
      }
      highlightKeyButton('#btn-equals');
      return;
    }

    // Percentage (%)
    if (e.key === '%') {
      e.preventDefault();
      calculator.applyPercent();
      calculator.updateDisplay();
      calculator.playOperator();
      highlightKeyButton('[data-action="percent"]');
      return;
    }

    // Backspace (DEL)
    if (e.key === 'Backspace') {
      e.preventDefault();
      calculator.delete();
      calculator.updateDisplay();
      calculator.playClick();
      highlightKeyButton('#btn-delete');
      return;
    }

    // Escape or 'c' (Clear AC)
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
      e.preventDefault();
      calculator.clear();
      calculator.updateDisplay();
      calculator.playClick();
      highlightKeyButton('#btn-clear');
      return;
    }
  });

  /* ------------------------------------------------------------------------
     Copy Result to Clipboard
     ------------------------------------------------------------------------ */
  function handleCopyResult() {
    if (calculator.hasError) return;
    const valueToCopy = calculator.currentOperand;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(valueToCopy)
        .then(() => showToast(`Copied ${valueToCopy} to clipboard`))
        .catch(() => fallbackCopy(valueToCopy));
    } else {
      fallbackCopy(valueToCopy);
    }
  }

  function fallbackCopy(text) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`Copied ${text} to clipboard`);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', handleCopyResult);
  }

  /* ------------------------------------------------------------------------
     Theme Toggle & Persistence
     ------------------------------------------------------------------------ */
  function initTheme() {
    const savedTheme = localStorage.getItem('aerocalc_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = savedTheme || (prefersDark ? 'dark' : 'dark'); // Default modern dark
    applyTheme(activeTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aerocalc_theme', theme);
    const sunIcon = document.querySelector('.icon-sun');
    const moonIcon = document.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.classList.remove('hide');
        moonIcon.classList.add('hide');
      } else {
        sunIcon.classList.add('hide');
        moonIcon.classList.remove('hide');
      }
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      showToast(`${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)} mode activated`);
    });
  }

  initTheme();

  /* ------------------------------------------------------------------------
     Sound Toggle
     ------------------------------------------------------------------------ */
  function updateSoundUI() {
    const soundOn = document.querySelector('.icon-sound-on');
    const soundOff = document.querySelector('.icon-sound-off');
    if (calculator.isSoundEnabled) {
      soundOn.classList.remove('hide');
      soundOff.classList.add('hide');
    } else {
      soundOn.classList.add('hide');
      soundOff.classList.remove('hide');
    }
  }

  if (soundToggleBtn) {
    updateSoundUI();
    soundToggleBtn.addEventListener('click', () => {
      calculator.isSoundEnabled = !calculator.isSoundEnabled;
      localStorage.setItem('aerocalc_sound', calculator.isSoundEnabled);
      updateSoundUI();
      if (calculator.isSoundEnabled) {
        calculator.playClick();
        showToast('Sound enabled');
      } else {
        showToast('Sound muted');
      }
    });
  }

  /* ------------------------------------------------------------------------
     History Panel Controls
     ------------------------------------------------------------------------ */
  function toggleHistoryPanel(forceState) {
    if (!historyPanel) return;
    const isOpen = historyPanel.classList.contains('is-open');
    const shouldOpen = forceState !== undefined ? forceState : !isOpen;
    if (shouldOpen) {
      historyPanel.classList.add('is-open');
    } else {
      historyPanel.classList.remove('is-open');
    }
  }

  if (historyToggleBtn) {
    historyToggleBtn.addEventListener('click', () => toggleHistoryPanel());
  }
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => toggleHistoryPanel(false));
  }
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      calculator.clearHistory();
      showToast('History cleared');
    });
  }

  /* ------------------------------------------------------------------------
     Shortcuts Modal Dialog
     ------------------------------------------------------------------------ */
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      shortcutsModal.classList.remove('hide');
    });
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      shortcutsModal.classList.add('hide');
    });
  }
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) {
        shortcutsModal.classList.add('hide');
      }
    });
  }

  /* ------------------------------------------------------------------------
     Helper Animations & Toast Notifications
     ------------------------------------------------------------------------ */
  function animateButtonPress(element) {
    if (!element) return;
    element.classList.add('btn-pressed');
    setTimeout(() => {
      element.classList.remove('btn-pressed');
    }, 140);
  }

  function highlightKeyButton(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      animateButtonPress(btn);
    }
  }

  let toastTimeout;
  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const toastMsg = toast.querySelector('.toast-message');
    if (toastMsg) toastMsg.innerText = message;

    if (isError) {
      toast.classList.add('toast-error');
    } else {
      toast.classList.remove('toast-error');
    }

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }
});
