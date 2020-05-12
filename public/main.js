$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $sessionInput = $('.sessionInput'); // Input for session ID
  var $zipInput = $('.zipInput');

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var $joinRoomPage = $('.join-room.page'); // The Join room page
  var $newSessionButton = $('.new-session');
  var $joinExistingButton = $('.join-existing');
  var $startGameButton = $('.start-game');
  var $voteYesButton = $('.vote-yes');
  var $voteNoButton = $('.vote-no');
  var $getLocationPage = $('.get-location.page');
  var $joinSessionPage = $('.join-session.page'); //The join session page

  // Prompt for setting a username
  var username;
  var roomCode;
  var location;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  const addParticipantsMessage = (data) => {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $joinRoomPage.show();
      $loginPage.off('click');
      //$currentInput = $inputMessage.focus();

      // Tell the server your username
      //socket.emit('add user', username);
    }
  }

  const setSession = () => {
    roomCode = cleanInput($sessionInput.val().trim());
    console.log("attempting to join room with roomcode: " + roomCode);
    if(roomCode) {
      socket.emit('add user', username);
      socket.emit("join room", roomCode);
      $joinSessionPage.fadeOut();
      $chatPage.show();
      $currentInput = $inputMessage.focus();
    }
  }

  const setZip = () => {
    location = cleanInput($zipInput.val().trim());
    console.log("using the following zip code for location: " + location);
    if(location) {
      socket.emit("send location", location);
      $getLocationPage.fadeOut();
      $chatPage.show();
      $currentInput = $inputMessage.focus();
    }
  }

  //Join existing session or create new session

  //on new session click, spin up a new session and direct the user there
  $newSessionButton.click(() => {
    console.log("clicked new session");
    $joinRoomPage.fadeOut();
    $getLocationPage.show();
    socket.emit('add user', username);
    roomCode = Math.round(Math.random() * 1000);
    console.log(roomCode);
    socket.emit("join room", roomCode);
    $currentInput = $inputMessage.focus();
  });

  //on join existing click, bring up join-session page, take input and redirect user there
  $joinExistingButton.click(() => {
    console.log('clicked join existing button');
    $joinRoomPage.fadeOut();
    $joinSessionPage.show();

    $currentInput = $sessionInput.focus();
  });

  $startGameButton.click(() => {
    console.log("clicked start button");
    socket.emit('start game');
    //TODO: fade out start, fade in vote buttons
  });

  $voteYesButton.click(() => {
    if(!$voteYesButton.hasClass("clicked")) {
      $voteYesButton.addClass("clicked");
      console.log("clicked the Yes button");
      socket.emit('yes');
    }
  });

  $voteNoButton.click(() => {
    if(!$voteNoButton.hasClass("clicked")) {
      $voteNoButton.addClass("clicked");
      console.log("clicked the No button");
      socket.emit('no');
    }
  });

  // Sends a chat message
  const sendMessage = () => {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
    const log = (message, options) => {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  }

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username && roomCode) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      }
      if(!username) {
        setUsername();
      }
      if(!roomCode) {
        setSession();
      }
      if(!location) {
        setZip();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  //Whenever the server emits 'room joined', log that
  socket.on('room joined', (data) => {
    log(data.message + data.room);
    addParticipantsMessage(data);
  });

  socket.on('game starting', (data) => {
    log(data.businessName);
    addParticipantsMessage(data);
  });

  socket.on('vote counted', (data) => {
    addChatMessage(data);
  });

   socket.on('game continuing', (data) => {
    log(data.businessName);
    addParticipantsMessage(data);
    $voteNoButton.removeClass("clicked");
    $voteYesButton.removeClass("clicked");
  })

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  socket.on('disconnect', () => {
    log('you have been disconnected');
  });

  socket.on('reconnect', () => {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('attempt to reconnect has failed');
  });

});
