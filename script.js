
let people = [];
let expenses = [];

function saveData() {
  
  try {
    localStorage.setItem('splitzy_people', JSON.stringify(people));
    localStorage.setItem('splitzy_expenses', JSON.stringify(expenses));
  } catch (err) {
    console.warn('Could not save data:', err);
  }
}

function loadData() {
  try {
    const savedPeople = localStorage.getItem('splitzy_people');
    const savedExpenses = localStorage.getItem('splitzy_expenses');

    people = JSON.parse(savedPeople || '[]');
    expenses = JSON.parse(savedExpenses || '[]');
  }
   catch (err) {
    console.warn('Could not load data:', err);
    people = [];
    expenses = [];
  }
}

function rupeesToPaise(rupeeString) {
  return Math.round(parseFloat(rupeeString) * 100);
}

function paiseToRupeeText(paise) {
  return '₹' + (paise / 100).toFixed(2);
}

function makeId() {
  return 'id_' + Math.random().toString(36).slice(2, 9);
}

function findPersonById(personId) {
  return people.find(function (p) {
    return p.id === personId;
  });
}

function splitEqually(totalPaise, personIds) {
  const sharePerPerson = Math.floor(totalPaise / personIds.length);
  let leftoverPaise = totalPaise - (sharePerPerson * personIds.length);

  const shares = {};
  personIds.forEach(function (id) {
    shares[id] = sharePerPerson;
    if (leftoverPaise > 0) {
      shares[id] += 1;
      leftoverPaise -= 1;
    }
  });
  return shares;
}

function calculateBalances() {
  const balances = {};

  people.forEach(function (person) {
    balances[person.id] = 0;
  });

  expenses.forEach(function (expense) {
    balances[expense.paidBy] += expense.amount;
    const shares = splitEqually(expense.amount, expense.splitBetween);
    Object.keys(shares).forEach(function (personId) {
      balances[personId] -= shares[personId];
    });
  });

  return balances;
}

function calculateSettlements(balances) {
  const creditors = []; 
  const debtors = [];   

  Object.keys(balances).forEach(function (personId) {
    const amount = balances[personId];
    if (amount > 0) {
      creditors.push({ id: personId, amount: amount });
    } else if (amount < 0) {
      
      debtors.push({ id: personId, amount: -amount });
    }
  });

  const settlements = [];

  
  while (creditors.length > 0 && debtors.length > 0) {
    
    creditors.sort(function (a, b) { return b.amount - a.amount; });
    debtors.sort(function (a, b) { return b.amount - a.amount; });

    const biggestCreditor = creditors[0];
    const biggestDebtor = debtors[0];
    const amountToSettle = Math.min(biggestCreditor.amount, biggestDebtor.amount);

    settlements.push({
      from: biggestDebtor.id,
      to: biggestCreditor.id,
      amount: amountToSettle
    });

    biggestCreditor.amount -= amountToSettle;
    biggestDebtor.amount -= amountToSettle;
    if (biggestCreditor.amount === 0) creditors.shift();
    if (biggestDebtor.amount === 0) debtors.shift();
  }

  return settlements;
}

function buildUpiLink(upiId, payeeName, amountPaise, note) {
  const amountInRupees = (amountPaise / 100).toFixed(2);
  return 'upi://pay' +
    '?pa=' + encodeURIComponent(upiId) +      
    '&pn=' + encodeURIComponent(payeeName) +  
    '&am=' + amountInRupees +                 
    '&cu=INR' +                               
    '&tn=' + encodeURIComponent(note);        
}


function renderPeopleList() {
  const listElement = document.getElementById('peopleList');


  if (people.length === 0) {
    listElement.innerHTML = '<li>No one added yet.</li>';
    return;
  }

  
  listElement.innerHTML = people.map(function (person) {
    return '<li>' +
      '<span>' + person.name + (person.upi ? ' (' + person.upi + ')' : '') + '</span>' +
      '<button class="remove-btn" onclick="removePerson(\'' + person.id + '\')">✕</button>' +
      '</li>';
  }).join('');
}

function renderExpenseFormOptions() {
  const paidBySelect = document.getElementById('paidBySelect');
  const checkboxesDiv = document.getElementById('splitCheckboxes');

  if (people.length === 0) {
    paidBySelect.innerHTML = '<option value="">Add people first</option>';
    checkboxesDiv.innerHTML = '';
    return;
  }

  paidBySelect.innerHTML = people.map(function (person) {
    return '<option value="' + person.id + '">' + person.name + '</option>';
  }).join('');

  checkboxesDiv.innerHTML = people.map(function (person) {
    return '<div class="split-row">' +
      '<input type="checkbox" class="split-checkbox" value="' + person.id + '" checked>' +
      '<label style="margin:0;font-weight:400">' + person.name + '</label>' +
      '</div>';
  }).join('');
}

function renderExpenseList() {
  const listElement = document.getElementById('expenseList');

  if (expenses.length === 0) {
    listElement.innerHTML = '<li>No expenses yet.</li>';
    return;
  }

  listElement.innerHTML = expenses.map(function (expense) {
    const payer = findPersonById(expense.paidBy);
    const payerName = payer ? payer.name : 'Someone';

    return '<li>' +
      '<span>' + expense.desc + ' — ' + paiseToRupeeText(expense.amount) +
      ' (paid by ' + payerName + ')</span>' +
      '<button class="remove-btn" onclick="removeExpense(\'' + expense.id + '\')">✕</button>' +
      '</li>';
  }).join('');
}

function renderSettleUp() {
  const introElement = document.getElementById('settleIntro');
  const listElement = document.getElementById('settleList');

  if (expenses.length === 0) {
    introElement.textContent = 'Add people and expenses to see who owes what.';
    listElement.innerHTML = '';
    return;
  }

  const balances = calculateBalances();
  const settlements = calculateSettlements(balances);

  if (settlements.length === 0) {
    introElement.textContent = 'Everyone is settled up. Nobody owes anything.';
    listElement.innerHTML = '';
    return;
  }

  introElement.textContent = settlements.length + ' payment(s) will settle everything:';

  listElement.innerHTML = settlements.map(function (settlement, index) {
    const fromPerson = findPersonById(settlement.from);
    const toPerson = findPersonById(settlement.to);

    let payHtml = '<p class="upi-id">' + toPerson.name + ' has no UPI ID added.</p>';

    if (toPerson.upi) {
      const link = buildUpiLink(toPerson.upi, toPerson.name, settlement.amount, 'Splitzy settlement');
      payHtml =
        '<div class="qr-box" id="qr-' + index + '"></div>' +
        '<p class="upi-id">' + toPerson.upi + '</p>' +
        '<a href="' + link + '"><button type="button">Pay now</button></a>';
    }

    return '<div class="settle-card">' +
      '<p>' + fromPerson.name + ' pays ' + toPerson.name + '</p>' +
      '<p class="amount">' + paiseToRupeeText(settlement.amount) + '</p>' +
      payHtml +
      '<button class="mark-paid-btn" onclick="markAsPaid(\'' + settlement.from + '\', \'' +
        settlement.to + '\', ' + settlement.amount + ')">Mark as paid</button>' +
      '</div>';
  }).join('');

  settlements.forEach(function (settlement, index) {
    const toPerson = findPersonById(settlement.to);
    const qrContainer = document.getElementById('qr-' + index);
    if (!qrContainer || !toPerson.upi) return; 

    const link = buildUpiLink(toPerson.upi, toPerson.name, settlement.amount, 'Splitzy settlement');

    new QRCode(qrContainer, { text: link, width: 130, height: 130 });
  });
}
function renderEverything() {
  renderPeopleList();
  renderExpenseFormOptions();
  renderExpenseList();
  renderSettleUp();
}

function addPerson() {
  const nameInput = document.getElementById('nameInput');
  const upiInput = document.getElementById('upiInput');
  const errorElement = document.getElementById('personError');

  const name = nameInput.value.trim(); 
  const upi = upiInput.value.trim();

  errorElement.textContent = ''; 

  
  if (name === '') {
    errorElement.textContent = 'Please enter a name.';
    return; 
  }

  const nameAlreadyUsed = people.some(function (p) {
    return p.name.toLowerCase() === name.toLowerCase();
  });
  if (nameAlreadyUsed) {
    errorElement.textContent = 'That name is already in the group.';
    return;
  }

  people.push({
    id: makeId(),
    name: name,
    upi: upi
  });

  nameInput.value = '';
  upiInput.value = '';
  saveData();
  renderEverything();
}

function removePerson(personId) {
  const isUsedInExpense = expenses.some(function (expense) {
    return expense.paidBy === personId || expense.splitBetween.includes(personId);
  });

  if (isUsedInExpense) {
    alert('This person is part of an expense. Delete that expense first.');
    return;
  }

  people = people.filter(function (p) {
    return p.id !== personId;
  });

  saveData();
  renderEverything();
}

function addExpense() {
  const descInput = document.getElementById('descInput');
  const amountInput = document.getElementById('amountInput');
  const paidBySelect = document.getElementById('paidBySelect');
  const errorElement = document.getElementById('expenseError');

  const desc = descInput.value.trim();
  const amountPaise = rupeesToPaise(amountInput.value);
  const paidBy = paidBySelect.value;

  const checkedBoxes = Array.from(document.querySelectorAll('.split-checkbox:checked'));
  const splitBetween = checkedBoxes.map(function (box) { return box.value; });

  errorElement.textContent = '';

  if (people.length < 2) {
    errorElement.textContent = 'Add at least two people first.';
    return;
  }
  if (desc === '') {
    errorElement.textContent = 'Say what the expense was for.';
    return;
  }
  if (!amountPaise || amountPaise <= 0) {
    errorElement.textContent = 'Enter an amount greater than zero.';
    return;
  }
  if (splitBetween.length === 0) {
    errorElement.textContent = 'Pick at least one person to split with.';
    return;
  }

  expenses.push({
    id: makeId(),
    desc: desc,
    amount: amountPaise,
    paidBy: paidBy,
    splitBetween: splitBetween
  });

  descInput.value = '';
  amountInput.value = '';

  saveData();
  renderEverything();
}

function removeExpense(expenseId) {
  expenses = expenses.filter(function (e) {
    return e.id !== expenseId;
  });
  saveData();
  renderEverything();
}

function markAsPaid(fromId, toId, amountPaise) {
  expenses.push({
    id: makeId(),
    desc: 'Settlement payment',
    amount: amountPaise,
    paidBy: fromId,
    splitBetween: [toId]
  });
  saveData();
  renderEverything();
}


document.getElementById('addPersonBtn').addEventListener('click', addPerson);
document.getElementById('addExpenseBtn').addEventListener('click', addExpense);

document.getElementById('nameInput').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') addPerson();
});

loadData();
renderEverything();
