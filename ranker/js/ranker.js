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
    finalRanking: [],
    selectedItems: []
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

// Justification algorithms
function shortestPath(graph, source, target) {
    let visited = {};
    for (const item in graph) {
        visited[item] = false;
    }
    visited[source] = true;

    let parent = {
        [source]: null
    };

    let queue = [source];
    
    // Generate shortest path from source to everywhere else
    while (queue.length > 0) {
        const current = queue.shift();

        // Gather children - items that current is better than
        let itemsCurrentIsBetterThan = [];
        for (const item in graph[current]) {
            if (!visited[item] && isBetterThan(current, item, graph)) {
                itemsCurrentIsBetterThan.push(item);
            }
        }

        itemsCurrentIsBetterThan.forEach(item => {
            parent[item] = current;
            visited[item] = true;
            queue.push(item);
        });
    }

    // Find path from source to target
    let path = [];
    let current = target;

    while (current != null) {
        path.push(current);
        current = parent[current];
    }
    path.reverse();

    return path;
}

function getQuestionNumber(questionsAsked, a, b) {
    let questionIndex = -1;
    questionsAsked.forEach((question, index) => {
        if (
            (question[0] === a && question[1] === b) ||
            (question[0] === b && question[1] === a)
        ) {
            questionIndex = index;
        }
    });

    if (questionIndex === -1) {
        return -1;
    }

    return questionIndex + 1;
}

function getJustificationPath(selections, finalRanking, comparisonGraph, questionHistory) {
    if (selections.length !== 2) return null;
    
    // Sort selections by their ranking position
    const sortedSelections = [...selections].sort((a, b) => 
        finalRanking.indexOf(a) - finalRanking.indexOf(b)
    );
    
    const path = shortestPath(comparisonGraph, sortedSelections[0], sortedSelections[1]);
    
    if (path.length > 1) {
        let pathArray = [];
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            
            const questionNumber = getQuestionNumber(questionHistory, current, next);
            
            if (questionNumber !== -1) {
                pathArray.push({
                    better: current,
                    worse: next,
                    questionNumber: questionNumber
                });
            }
        }
        return pathArray;
    }
    
    return null;
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
    
    // Reset selection state
    appState.selectedItems = [];
    
    appState.finalRanking.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        rankingItem.dataset.item = item;
        
        rankingItem.innerHTML = `
            <div class="rank-number">#${index + 1}</div>
            <div class="item-name">${escapeHtml(item)}</div>
        `;
        
        // Add click handler for item selection
        rankingItem.addEventListener('click', () => handleItemSelection(item, rankingItem));
        
        rankingList.appendChild(rankingItem);
    });
    
    // Clear any existing justification display
    updateJustificationDisplay();
    
    showPage('results-page');
}

function handleItemSelection(item, element) {
    const selectedIndex = appState.selectedItems.indexOf(item);
    
    if (selectedIndex === -1) {
        // Item not selected, add it
        if (appState.selectedItems.length >= 2) {
            // Remove oldest selection if we already have 2
            const oldestItem = appState.selectedItems.shift();
            const oldestElement = document.querySelector(`[data-item="${oldestItem}"]`);
            if (oldestElement) {
                oldestElement.classList.remove('selected');
            }
        }
        appState.selectedItems.push(item);
        element.classList.add('selected');
    } else {
        // Item already selected, remove it
        appState.selectedItems.splice(selectedIndex, 1);
        element.classList.remove('selected');
    }
    
    updateJustificationDisplay();
}

function updateJustificationDisplay() {
    let justificationArea = document.getElementById('justification-area');
    
    // Create justification area if it doesn't exist
    if (!justificationArea) {
        justificationArea = document.createElement('div');
        justificationArea.id = 'justification-area';
        justificationArea.className = 'justification-area';
        
        const resultsPage = document.getElementById('results-page');
        const pageContent = resultsPage.querySelector('.page-content');
        const newRankingBtn = document.getElementById('new-ranking-btn');
        
        pageContent.insertBefore(justificationArea, newRankingBtn);
    }
    
    if (appState.selectedItems.length === 0) {
        justificationArea.innerHTML = `
            <div class="justification-prompt">
                Click any pair of items to learn why one ranks higher than the other
            </div>
        `;
    } else if (appState.selectedItems.length === 1) {
        justificationArea.innerHTML = `
            <div class="justification-prompt">
                Select another item to see the comparison
            </div>
        `;
    } else if (appState.selectedItems.length === 2) {
        const path = getJustificationPath(
            appState.selectedItems, 
            appState.finalRanking, 
            appState.comparisonGraph, 
            appState.questionHistory
        );
        
        if (path && path.length > 0) {
            let pathHtml = '';
            path.forEach(step => {
                pathHtml += `
                    <div class="justification-step">
                        (Q${step.questionNumber}) You said <strong>${escapeHtml(step.better)}</strong> is better than <strong>${escapeHtml(step.worse)}</strong>
                    </div>
                `;
            });
            
            // Sort selected items by ranking order for display
            const sortedForDisplay = [...appState.selectedItems].sort((a, b) => 
                appState.finalRanking.indexOf(a) - appState.finalRanking.indexOf(b)
            );
            
            justificationArea.innerHTML = `
                <div class="justification-header">Why "${escapeHtml(sortedForDisplay[0])}" ranks higher than "${escapeHtml(sortedForDisplay[1])}":</div>
                ${pathHtml}
            `;
        } else {
            justificationArea.innerHTML = `
                <div class="justification-error">
                    No direct comparison path found between these items.
                </div>
            `;
        }
    }
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
            finalRanking: [],
            selectedItems: []
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
