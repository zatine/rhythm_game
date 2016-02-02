(function () {
	"use strict";
	/* VARIABLES */
			//Music
		var audioContext = new (window.AudioContext || window.webkitAudioContext),
			audioBuffer,
			sourceNode,
			analyser,
			javascriptNode,
			song = {
				src: 'mp3/exampleSong.mp3',
				loaded: false,
				buffer: '',
				blockDistance: 2000,
				maxInQueue: 3,
                length: 0
			},
			// Game
			canvas = document.getElementById('canvas'),
			ctx = canvas.getContext('2d'),
			reqAnimFrame = window.requestAnimationFrame,
			player = {
				score: 0,
				total: {
					bad: 0,
					ok: 0,
					good: 0,
					great: 0,
					perfect: 0
				}
			},
			game = {
				start: {
					text: 'Loading...',
					key: 13
				},
				on: false,
				startTime: '',
				perfect:{distance: 7, color: '#b200c9', title: 'perfect', score: 100},
				great: {distance: 17, color: '#6a00c6', title: 'great', score: 50},
				good: {distance: 27, color: '#005cd9', title: 'good', score: 25},
				ok: {distance: 37, color: '#00d94b', title: 'ok', score: 10},
				bad: {color: '#9b0c00', title: 'bad', score: 0},
				speed: 4,
				gradeText: document.getElementById('grade'),
				gradeColor: 'black',
				text: "",
				maxTries: 3,
                sendBlocks: false
			};
		;
	
	/* MUSIC */

	setupAudioNodes();
	loadSound(song.src);

	function setupAudioNodes() {
		javascriptNode = audioContext.createScriptProcessor(2048, 1, 1)
		javascriptNode.connect(audioContext.destination);

		analyser = audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.3;
		analyser.fftSize = 256; //power of two
		analyser.minDecibels = -70; // how low can the sound be to be registered as a frequency

		sourceNode = audioContext.createBufferSource();
		sourceNode.connect(analyser);
		analyser.connect(javascriptNode);
		sourceNode.connect(audioContext.destination);
	}

	function loadSound(url){
		var request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';

		request.onload = function() {
			audioContext.decodeAudioData(request.response, function (buffer) {
				//when the song has loaded, change the message on the canvas
				game.start.text = 'Press Enter to Begin';
				song.loaded = true;
				song.buffer = buffer;
				
				//update the scene and start the game
				update();

			}, onError);
		}

		request.send();
	}

	function playSound(buffer){
		sourceNode.buffer = buffer;
		sourceNode.start(0);
        sourceNode.length = buffer.duration * 1000;
        sourceNode.addEventListener('ended', function(){
          sourceNode.stop();
        });
	}

	function onError(e){
		console.log(e);
	}

	
	/* GAME */
	
	//everytime something in the audio buffer changes this script is run, adding new blocks if the game is running
	javascriptNode.onaudioprocess = function () {
		//gets the frequency at each point and calculates the average value of the array
		var array = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(array);
		var average = getAverage(array);
      
		//if the game is running, create a new block
		if(game.on){
			//calculate the time the block will begin to fall relative to the time the song started
			var fallTime = new Date();
			fallTime = fallTime.getTime();
			fallTime = fallTime - game.startTime;
			//fallTime -= 20000; //makes the notes match the music better, since they reach the keys at the time they would have started falling

			//create a block if the function returns true
			keys.forEach(function (key) {
				if(compareFrequency(key.frequency, key, fallTime, average)) {key.queue.push(new TimedBlock(key, fallTime));}
			});
		}
	}

	//checks if the condition to create a new block is met
	function compareFrequency(value, key, time, average){
		//only add a new block if...
		if(average % value === 0 && average != 0 && key.queue.length < song.maxInQueue && game.sendBlocks){
			for(var i = 0; i < song.maxInQueue; i++){
				if(key.queue[i] && key.queue[i].time > time - song.blockDistance)	return false;
			}
			return true;
		}
	}

	//calculate the average value of an array
	function getAverage(array) {
		var values = 0,
			average,
			length = array.length;

		for(var i = 0; i < length; i++){
			values += array[i];
		}

		average = values / length;
		return Math.ceil(average);
	}

	//grade how well the player hit a block
	function setScore(grade, element) {
		//checks if the falling block has already been graded, only grades if that is not the case
			element.scored = true;
			element.parent.queue.push(element); // puts the element back in the array to continue the animation, however scored is set to true so no interaction is possible
			//element.alpha = 0.5;
			element.img.src = 'img/' + element.name + '_' + grade['title'] + '.png';
			element.parent.queue.shift();
			player.score += grade['score'];
			player.total[grade['title']]++;
			document.getElementsByClassName(grade['title'])[0].innerHTML = player.total[grade['title']];
			//game.gradeColor = grade['color'];
			//game.gradeText = grade['title'].toUpperCase() + "!";
			game.gradeText.innerHTML = grade['title'].toUpperCase() + "!";
			game.gradeText.style.color = grade['color'];
			document.querySelector('.score h1').innerHTML = player.score;
	}
	
	//compare the position of the block and its key in y-axis
	function matchHeight(key, block, distance) {
		return (	(block.y < key.y 											// is the block y-value within {distance} pixels from matching the key perfectly from the top
				  && block.y > key.y - distance)
				  ||(block.y + block.height < key.y + key.height + distance 	// OR is the block y-value within {distance} pixels from matching the key perfectly from the bottom
				  && block.y + block.height > key.y + key.height));
	}

	//KEY CONSTRUCTOR - everything that is unique for each instance of Key
	function Key(keyCode, src, x, freq) {
		this.keyCode = keyCode;
		this.name = src;

		//graphics for the key
		this.img = new Image();
		this.img.src = 'img/' + this.name + '.png';
		this.x = x;
		this.pressed = false;
		
		//which blocks belong to this key
		this.queue = [];
		
		//for comparison at block creation
		this.frequency = freq;
	
		
	}

	//KEY PROTOTYPE - everything shared by each instance of Key
	Key.prototype = {
		//function to check if the key is overlapping with the element in the parameter
		checkOverlap : function (element) {
			/*
			//is the element overlapping key in any direction
			if(element.x >= this.x - element.width && element.x < this.x + this.width && element.y >= this.y - element.height && element.y < this.y + this.width) {}*/
			//returns different results depending on how good the element matches the key
				if(element.scored === false){
					if (matchHeight(this, element, game.perfect.distance)) { setScore(game.perfect, element);}
					else if (matchHeight(this, element, game.great.distance)) { setScore(game.great, element);}
					else if (matchHeight(this, element, game.good.distance)) { setScore(game.good, element);}
					else if (matchHeight(this, element, game.ok.distance)) { setScore(game.ok, element);}
					//you can try to hit a key up to {game.maxTries} times until the score is automatically set to bad and the block doesn't count anymore
					else if (element.tries <= game.maxTries && !element.scored) {	
						element.tries += 1;
						if(element.tries === game.maxTries){
							setScore(game.bad, element);
						}
				}
			}
			
		},
		addImage : function (x, y) {
			ctx.drawImage(this.img, x, y);
		},
		width: 50,
		height: 50,
		y: canvas.height - 100,
		pressKey: function (){
			this.pressed = !this.pressed;
			this.img.src = this.pressed ? 'img/' + this.name + '_pressed.png' : 'img/' + this.name + '.png';
			
			if (this.pressed && this.queue[0] && (this.queue[0].y + this.queue[0].height) > 0) {
					this.checkOverlap(this.queue[0]);
			}
		}
	};

	//TIMEDBLOCK CONSTRUCTOR - everything unique for each falling block
	function TimedBlock(correct, time) {
		//which key does this block belong to, copies values and puts it in the key's queue
		this.parent = correct;
		this.x = correct.x;
		this.name = correct.name;
		this.img = new Image();
		this.img.src = 'img/' + this.name + '.png';
		//correct.queue.push(this);
		
		//create the block outside of the screen
		this.y = -50;
		
		//when should the block start falling
		this.time = time || 0;
		
		//how many times did the player try to hit the block
		this.tries = 0;
		
		//has the block been scored
		this.scored = false;
	}

	//TIMEDBLOCK PROTOTYPE - everything shared by each falling block
	TimedBlock.prototype = {
		//makes element fall down unless it's out of sight
		fallDown: function () { 
			this.y += this.y < canvas.height + this.height ? game.speed : 0;
		},
		addImage: function (x, y) {
			ctx.drawImage(this.img, x, y);
		},
		width: 50,
		height: 50
	};
	
	//creates the keys at the given positions, created in array to be able to loop functions over each one
	var xDistance = Math.floor(canvas.width / 9),
		keys = [new Key(65, 'left', xDistance, 13),
				new Key(87, 'up', xDistance * 3, 21),
				new Key(83, 'down', xDistance * 5, 17),
				new Key(68, 'right', xDistance * 7, 11)
				];
	
	//moves all blocks on screen, removes blocks that have left the canvas
	function moveBlocks(block, currentTime){
		if (currentTime - game.startTime >= block.time) {
				block.addImage(block.x, block.y);
				block.fallDown();
		}

		//if the block falls past the key without the user pressing a button, the grade is automatically set to bad for that block
		if (block.y > block.parent.y + block.parent.height + 10 && !block.scored) {
			setScore(game.bad, block);
		}
			
		//if the block falls out of the canvas it is deleted from the game
		if(block.y > canvas.height){
			var index = block.parent.queue.indexOf(block);
			if (index > -1) block.parent.queue.splice(index, 1);
		}
	}

	//updates the canvas
	function update() {
		if(game.on){
			
			//time variable to compare with the starting time
			var currentTime = new Date();
			currentTime = currentTime.getTime();
			game.sendBlocks = (currentTime - game.startTime) < (sourceNode.length - song.blockDistance - 1000);
			//clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			//draw keys
			keys.forEach(function (key) {
				key.addImage(key.x, key.y);
			});

			//start animating each block if the timing matches
			ctx.globalAlpha = 0.8;
			keys.forEach(function (key) {
				key.queue.forEach(function (block) {moveBlocks(block, currentTime);});
			});
			ctx.globalAlpha = 1;
            
            if(!game.sendBlocks && currentTime - game.startTime > sourceNode.length) setTimeout(endGame, 3000);
			reqAnimFrame(update);
		}
		else {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.font = "30px Calibri";
			document.querySelector('.message').innerHTML = game.start.text;
			ctx.fillStyle = 'black';
			ctx.fillText(game.text, canvas.width / 2 - ctx.measureText(game.text).width / 2, canvas.height / 2 - 50);
		}
	}

	//counts the players average score - WIP
	function countScore() {
		var average = 0,
			scoreType = 0;
		for(var score in player.total) { 
			average += player.total[score];
			scoreType++;
		}
		
		average = player.score / average;
		if (average > 95) return 'Perfect';
		if (average > 40) return 'Great';
		if (average > 20) return 'Good';
		if (average > 10) return 'OK';
		else return 'Not so good';
	}
	
	//game over screen
	function endGame() {
        var performanceText = document.querySelector('.results h1 span'),
            scoreText = document.querySelector('.results p span'),
            average = countScore(),
            averageClass = average === 'Not so good' ? 'bad' : average.toLowerCase();
      
        game.gradeText.innerHTML = "";
		game.on = false;
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        document.querySelector('.score').classList.add('hide');
        document.querySelector('.results').classList.remove('hide');
		performanceText.classList.add(averageClass);
		performanceText.innerHTML = average + "!";
        scoreText.classList.add(averageClass);
        scoreText.innerHTML = player.score;
      
		update();
	}
	
	//each time a key is pressed
	document.addEventListener('keydown', function (e) {
		var keyCode = e.keyCode;

		//if the game is running, check which key is being pressed and how well it matches the falling blocks
		if(game.on){
			keys.forEach(function (key) {
				if (keyCode === key.keyCode && !key.pressed) key.pressKey();
				
			});
			
		}
		//if the game has not yet started, start by pressing enter
		else if(game.on === false){
			if (keyCode === game.start.key && song.loaded){
				game.on = true;
                game.sendBlocks = true;
				document.querySelector('.instructions').classList.add('hide');
              
				//starts timer
				game.startTime = new Date();
				game.startTime = game.startTime.getTime();
              
				//plays song
				playSound(song.buffer);
				update();
			}
		}

	});
	
	//each time you let go of a key
	document.addEventListener('keyup', function (e) {
		var keyCode = e.keyCode;
		
		//the pressed status of each key let go of is set to false
		keys.forEach(function (key) {
			if (keyCode === key.keyCode && key.pressed) key.pressKey();
		});

	});
	
	//draw the canvas
	reqAnimFrame(update);
}());
