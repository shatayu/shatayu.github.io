// Constants
const COMPARISON_STATES = {
    BETTER: 1,
    WORSE: 0,
    NOT_COMPARED: -1,
};

// Global state
let appState = {
    items: [],
    comparisonGraph: {},
    questionHistory: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
    finalRanking: []
};

// Core ranking algorithms
function generateEmptyGraph(items) {
    const graph = {};
    items.forEach(item1 => {
        graph[item1] = {};
        items.forEach(item2 => {
            graph[item1][item2] = COMPARISON_STATES.NOT_COMPARED;
        });
    });
    return graph;
}

function canCompare(a, b, comparisonGraph) {
    return comparisonGraph[a][b] !== COMPARISON_STATES.NOT_COMPARED;
}

function isBetterThan(a, b, comparisonGraph) {
    return comparisonGraph[a][b] === COMPARISON_STATES.BETTER;
}

function iterativeMergeSort(arr, comparisonGraph) {
    let sorted = arr.slice();
    let n = sorted.length;
    let buffer = new Array(n);

    for (let size = 1; size < n; size *= 2) {
        for (let leftStart = 0; leftStart < n; leftStart += 2 * size) {
            let left = leftStart;
            let right = Math.min(left + size, n);
            let leftLimit = right;
            let rightLimit = Math.min(right + size, n);
            let i = left;

            while (left < leftLimit && right < rightLimit) {
                if (canCompare(sorted[left], sorted[right], comparisonGraph)) {
                    if (isBetterThan(sorted[left], sorted[right], comparisonGraph)) {
                        buffer[i++] = sorted[left++];
                    } else {
                        buffer[i++] = sorted[right++];
                    }
                } else {
                    return {
                        array: sorted,
                        nextQuestion: [sorted[left], sorted[right]]
                    };
                }
            }

            while (left < leftLimit) {
                buffer[i++] = sorted[left++];
            }

            while (right < rightLimit) {
                buffer[i++] = sorted[right++];
            }
        }

        let temp = sorted;
        sorted = buffer;
        buffer = temp;
    }
    
    return {
        array: sorted,
        nextQuestion: null
    };
}

function getNextQuestion(items, comparisonGraph) {
    return iterativeMergeSort(items, comparisonGraph);
}

function updateComparisonGraph(graph, better, worse) {
    return {
        ...graph,
        [better]: {
            ...graph[better],
            [worse]: COMPARISON_STATES.BETTER
        },
        [worse]: {
            ...graph[worse],
            [better]: COMPARISON_STATES.WORSE
        }
    };
}

function estimateQuestionsRemaining(items) {
    const n = items.length;
    if (n <= 1) return 0;
    const log = Math.ceil(Math.log2(n));
    return n * log - 2 ** log + 1;
}

// Page management
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Input page logic
function initializeInputPage() {
    const form = document.getElementById('input-form');
    const textarea = document.getElementById('items-input');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputText = textarea.value.trim();
        const items = inputText
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        
        if (items.length < 2) {
            alert('Please enter at least 2 items to rank');
            return;
        }
        
        startRanking(items);
    });
}

// Ranking page logic
function startRanking(items) {
    appState.items = items;
    appState.comparisonGraph = generateEmptyGraph(items);
    appState.questionHistory = [];
    appState.currentQuestionIndex = 0;
    
    showPage('ranking-page');
    updateRankingPage();
}

function updateRankingPage() {
    const result = getNextQuestion(appState.items, appState.comparisonGraph);
    
    if (result.nextQuestion) {
        appState.currentQuestion = result.nextQuestion;
        displayQuestion(result.nextQuestion);
        updateProgress();
    } else {
        // Ranking complete
        appState.finalRanking = result.array;
        showResults();
    }
}

function displayQuestion(question) {
    const choiceA = document.getElementById('choice-a');
    const choiceB = document.getElementById('choice-b');
    
    choiceA.textContent = question[0];
    choiceB.textContent = question[1];
    
    choiceA.onclick = () => handleChoice(question[0], question[1]);
    choiceB.onclick = () => handleChoice(question[1], question[0]);
}

function handleChoice(better, worse) {
    appState.comparisonGraph = updateComparisonGraph(appState.comparisonGraph, better, worse);
    
    // Update history
    const newHistory = [...appState.questionHistory.slice(0, appState.currentQuestionIndex), [better, worse]];
    appState.questionHistory = newHistory;
    appState.currentQuestionIndex = newHistory.length;
    
    updateRankingPage();
}

function updateProgress() {
    const progress = document.getElementById('progress');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    const totalQuestions = estimateQuestionsRemaining(appState.items);
    const questionsAsked = appState.currentQuestionIndex;
    
    progress.textContent = `Question ${questionsAsked + 1} of up to ${totalQuestions}`;
    
    // Update button states
    backBtn.disabled = false; // Always allow going back
    forwardBtn.disabled = appState.currentQuestionIndex >= appState.questionHistory.length;
}

function initializeRankingPage() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    backBtn.addEventListener('click', () => {
        if (appState.currentQuestionIndex > 0) {
            // Revert to previous state
            const newIndex = appState.currentQuestionIndex - 1;
            appState.currentQuestionIndex = newIndex;
            
            // Rebuild graph from history up to newIndex
            let newGraph = generateEmptyGraph(appState.items);
            for (let i = 0; i < newIndex; i++) {
                const [better, worse] = appState.questionHistory[i];
                newGraph = updateComparisonGraph(newGraph, better, worse);
            }
            appState.comparisonGraph = newGraph;
            updateRankingPage();
        } else {
            showPage('input-page');
        }
    });
    
    forwardBtn.addEventListener('click', () => {
        if (appState.currentQuestionIndex < appState.questionHistory.length) {
            const [better, worse] = appState.questionHistory[appState.currentQuestionIndex];
            handleChoice(better, worse);
        }
    });
}

// Results page logic
function showResults() {
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    appState.finalRanking.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        rankingItem.innerHTML = `
            <div class="rank-number">#${index + 1}</div>
            <div class="item-name">${escapeHtml(item)}</div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
    
    showPage('results-page');
}

function initializeResultsPage() {
    const newRankingBtn = document.getElementById('new-ranking-btn');
    
    newRankingBtn.addEventListener('click', () => {
        // Reset state
        appState = {
            items: [],
            comparisonGraph: {},
            questionHistory: [],
            currentQuestionIndex: 0,
            currentQuestion: null,
            finalRanking: []
        };
        
        // Clear input
        document.getElementById('items-input').value = '';
        
        showPage('input-page');
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeInputPage();
    initializeRankingPage();
    initializeResultsPage();
    
    // Start with input page
    showPage('input-page');
});
