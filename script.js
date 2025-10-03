const API_BASE_URL = 'https://satscoreupbackend-production.up.railway.app';

class SATApp {
    constructor() {
        this.currentTest = null;
        this.currentModule = null;
        this.allModules = [];
        this.currentModuleIndex = 0;
        this.currentQuestions = [];
        this.userAnswers = new Map();
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.loadTests();
    }

    bindEvents() {
        document.getElementById('back-to-tests').addEventListener('click', () => {
            this.showView('test-list-view');
            this.loadTests();
        });

        document.getElementById('back-to-modules').addEventListener('click', () => {
            this.showView('test-list-view');
            this.loadTests();
        });

        document.getElementById('submit-module').addEventListener('click', () => {
            this.submitModule();
        });

        document.getElementById('next-module').addEventListener('click', () => {
            this.nextModule();
        });
    }

    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(viewId).classList.add('active');
    }

    async loadTests() {
        const container = document.getElementById('tests-container');
        container.innerHTML = '<div class="loading">Loading tests...</div>';

        try {
            const response = await fetch(`${API_BASE_URL}/tests`);
            const tests = await response.json();

            container.innerHTML = '';
            tests.forEach(test => {
                const testCard = document.createElement('div');
                testCard.className = 'test-card';
                testCard.innerHTML = `
                    <h3>${test.title}</h3>
                    <p>Complete SAT practice test with multiple modules</p>
                    <button class="btn btn-primary">Start Test</button>
                `;
                testCard.addEventListener('click', () => this.startTest(test));
                container.appendChild(testCard);
            });
        } catch (error) {
            container.innerHTML = '<div class="loading">Error loading tests. Please try again.</div>';
            console.error('Error loading tests:', error);
        }
    }

    async startTest(test) {
        this.currentTest = test;
        
        try {
            const response = await fetch(`${API_BASE_URL}/tests/${test.id}/modules`);
            this.allModules = await response.json();
            this.currentModuleIndex = 0;
            
            document.getElementById('current-test-title').textContent = test.title;
            
            await this.loadModule(this.allModules[0]);
            this.showView('test-view');
        } catch (error) {
            console.error('Error starting test:', error);
            alert('Error starting test. Please try again.');
        }
    }

    async loadModule(module) {
        this.currentModule = module;
        this.userAnswers.clear();
        
        const moduleSpan = document.getElementById('current-module');
        moduleSpan.textContent = `${module.title} (${this.currentModuleIndex + 1} of ${this.allModules.length})`;
        
        const progressFill = document.getElementById('progress-fill');
        const progress = ((this.currentModuleIndex + 1) / this.allModules.length) * 100;
        progressFill.style.width = `${progress}%`;

        const container = document.getElementById('questions-container');
        container.innerHTML = '<div class="loading">Loading questions...</div>';

        try {
            const response = await fetch(`${API_BASE_URL}/tests/${this.currentTest.id}/modules/${module.id}/questions`);
            this.currentQuestions = await response.json();
            
            this.renderQuestions();
        } catch (error) {
            container.innerHTML = '<div class="loading">Error loading questions. Please try again.</div>';
            console.error('Error loading questions:', error);
        }
    }

    renderQuestions() {
        const container = document.getElementById('questions-container');
        container.innerHTML = '';

        this.currentQuestions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question';
            questionDiv.innerHTML = `
                <h3>Question ${index + 1}</h3>
                <div class="question-content">${this.renderMarkdown(question.content_markdown)}</div>
                ${this.renderQuestionInput(question)}
            `;
            container.appendChild(questionDiv);
        });
    }

    renderMarkdown(markdown) {
        return markdown
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    renderQuestionInput(question) {
        if (question.type === 'mcq') {
            const choicesHtml = question.choices.map(choice => `
                <div class="choice" data-choice="${choice.label}">
                    <input type="radio" name="question_${question.id}" value="${choice.label}" id="q${question.id}_${choice.label}">
                    <span class="choice-label">${choice.label})</span>
                    <div class="choice-content">${this.renderMarkdown(choice.content_markdown)}</div>
                </div>
            `).join('');

            return `<div class="choices">${choicesHtml}</div>`;
        } else if (question.type === 'fill_blank') {
            return `
                <div class="fill-blank">
                    <input type="text" class="fill-blank-input" placeholder="Type your answer here..." data-question-id="${question.id}">
                </div>
            `;
        }
        return '';
    }

    collectAnswers() {
        this.userAnswers.clear();

        this.currentQuestions.forEach(question => {
            if (question.type === 'mcq') {
                const checkedRadio = document.querySelector(`input[name="question_${question.id}"]:checked`);
                if (checkedRadio) {
                    this.userAnswers.set(question.id, [checkedRadio.value]);
                }
            } else if (question.type === 'fill_blank') {
                const input = document.querySelector(`input[data-question-id="${question.id}"]`);
                if (input && input.value.trim()) {
                    this.userAnswers.set(question.id, [input.value.trim()]);
                }
            }
        });

        document.querySelectorAll('.choice').forEach(choice => {
            choice.addEventListener('click', function() {
                const radio = this.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    
                    this.parentElement.querySelectorAll('.choice').forEach(c => c.classList.remove('selected'));
                    this.classList.add('selected');
                }
            });
        });
    }

    async submitModule() {
        this.collectAnswers();

        const answers = [];
        this.userAnswers.forEach((selectedAnswers, questionId) => {
            answers.push({
                question_id: questionId,
                selected_answers: selectedAnswers
            });
        });

        this.currentQuestions.forEach(question => {
            if (!this.userAnswers.has(question.id)) {
                answers.push({
                    question_id: question.id,
                    selected_answers: []
                });
            }
        });

        const submitData = {
            module_id: this.currentModule.id,
            answers: answers
        };

        try {
            const response = await fetch(`${API_BASE_URL}/tests/${this.currentTest.id}/modules/${this.currentModule.id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(submitData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            this.showResults(results);
        } catch (error) {
            console.error('Error submitting module:', error);
            alert('Error submitting answers. Please try again.');
        }
    }

    showResults(results) {
        document.getElementById('score-percentage').textContent = `${Math.round(results.score_percentage)}%`;
        document.getElementById('correct-count').textContent = results.correct_answers;
        document.getElementById('total-count').textContent = results.total_questions;

        const resultsContainer = document.getElementById('question-results');
        resultsContainer.innerHTML = '';

        results.question_results.forEach((result, index) => {
            const question = this.currentQuestions.find(q => q.id === result.question_id);
            const resultDiv = document.createElement('div');
            resultDiv.className = `question-result ${result.is_correct ? 'correct' : 'incorrect'}`;
            
            resultDiv.innerHTML = `
                <div class="result-header">
                    <div class="result-status ${result.is_correct ? 'correct' : 'incorrect'}">
                        ${result.is_correct ? '✓' : '✗'}
                    </div>
                    <h4>Question ${index + 1}: ${question.title}</h4>
                </div>
                <div class="result-details">
                    <div class="result-answers">
                        <p><strong>Your answer:</strong> ${result.user_answers.length > 0 ? result.user_answers.join(', ') : 'No answer'}</p>
                        <p><strong>Correct answer:</strong> ${result.correct_answers.join(', ')}</p>
                    </div>
                    ${result.explanation_markdown ? `
                        <div class="explanation">
                            <h4>Explanation:</h4>
                            <div>${this.renderMarkdown(result.explanation_markdown)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
            resultsContainer.appendChild(resultDiv);
        });

        const nextButton = document.getElementById('next-module');
        if (this.currentModuleIndex < this.allModules.length - 1) {
            nextButton.style.display = 'inline-block';
            nextButton.textContent = 'Next Module';
        } else {
            nextButton.style.display = 'inline-block';
            nextButton.textContent = 'Test Complete';
        }

        this.showView('results-view');
    }

    async nextModule() {
        if (this.currentModuleIndex < this.allModules.length - 1) {
            this.currentModuleIndex++;
            await this.loadModule(this.allModules[this.currentModuleIndex]);
            this.showView('test-view');
        } else {
            this.showView('test-list-view');
            this.loadTests();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SATApp();
});