function PSphinx(){
	this.m_Recognizer = null;
	this.m_CBManager = null;
	this.m_Recorder = null;
	this.m_Hypothesis = null;

	this.m_strListenFor = '';//the current word we need to listen for
	
	this.m_bReady = false;
};

var DEBUG = true;

/**
*
*this needs to be assigned in the application itself.
*This is where adding and removing of grammars and words is done
*
**/
PSphinx.prototype.init = function(){

};

/* ----------------------------------- Initialization of Application---------------------------------  */
PSphinx.prototype.startup = function(){
	this.m_CBManager = new CallbackManager();
	this.m_Hypothesis = [];

	var that = this;

	this.spawnWorker('js/recognizer.js', function(recognizer){

		that.m_Recognizer = recognizer;
		that.m_Recognizer.onmessage = function(event){ that.onMessage(event) };
		that.m_Recognizer.postMessage( { command : 'initialize', callbackId : that.createCBId( function(){ that.readyUp(); } ) } ); 

	});
};

PSphinx.prototype.spawnWorker = function(url, onReady){
	var recognizer = new Worker(url);

	recognizer.onmessage = function(event){
		//on ready called when message is sent back
		onReady(recognizer);
	};

	recognizer.postMessage("");

};

PSphinx.prototype.readyUp = function(){
	this.m_bReady = true;
	this.setupAudio();
	this.init(); //once we are ready, we can begin by adding words and grammars
};

PSphinx.prototype.onMessage = function(event) {

	if(event.data.hasOwnProperty('status')){

		var status = event.data.status;
		var command = event.data.command;
		var code = 'none';

		if(event.data.hasOwnProperty('code')) code = event.data.code;

		console.log("Command: ", command, ", Status: ", status, ", Code: ", code);

	}


	if(event.data.hasOwnProperty('id')) {
		//if message has id field, we might have a callback
		var callback = this.m_CBManager.get(event.data['id']);
		var data = {};

		if(event.data.hasOwnProperty('data')) data = event.data.data;
		if(callback) callback(data);

	}


    // This is a case when the recognizer has a new hypothesis
    if (event.data.hasOwnProperty('hyp')) {
        this.checkHypothesis(event.data);
    }
};
/*-----------------------------------------------------------------------------------------*/


/*---------------------- to Use the recognizer---------------------------------------------*/

PSphinx.prototype.postMessage = function(messageObj){

	if(!this.m_bReady) return console.warn("Recognizer Worker Not Ready");

	this.m_Recognizer.postMessage(messageObj);

};

//add a callback ID to the Callback Manager, returns an ID
PSphinx.prototype.createCBId = function(callback){
	return this.m_CBManager.add( callback );
};

// [[WORD, PHONEMES], [ANTOHER_WORD, PHONEMES]]
PSphinx.prototype.addWords = function(words){
	this.postMessage({ command : 'addWords', 
		data : words, 
		callbackId : this.createCBId(function(){
			console.log("Words Added: ", words);
		}) 
	});
};

PSphinx.prototype.addGrammar = function(grammarObj){
	this.postMessage({ command : 'addGrammar', 
		data : grammarObj , 
		callbackId : this.createCBId(function(){
			console.log("Grammar Added: ", grammarObj);
		})
	});
};


//id is the id of the grammar created
PSphinx.prototype.start = function(id){
	//this.postMessage({ command : 'start', data : id });
	this.m_Recorder.start();
};

//audio to be processed by the recognizer
//data => array fo audio data
PSphinx.prototype.process = function(data){
	var that = this;
	this.postMessage({ command : 'process', 
		data : data,
		callbackId : this.createCBId(function(_data){
			that.checkHypothesis(_data);
		})
	});
};

PSphinx.prototype.end = function(){
	/*var that = this;
	this.postMessage({ command : 'stop', 
		callbackId : this.createCBId(function(data){
			that.checkHypothesis(data);
		})
	});*/

	this.m_Recorder.stop();
};

PSphinx.prototype.checkHypothesis = function(data){

	var hyp = '';
	var isFinal = false;

	hyp = data.hyp;
	if(data.hasOwnProperty('final')) isFinal = data.final;

	this.finalizeHyp(hyp, isFinal);
};

/*------------------------PRESENT DATA----------------------------*/

PSphinx.prototype.finalizeHyp = function(hypothesis, final){

	if(!final && hypothesis ){
      this.m_Recorder.stop();
      turnOff();
	}
	if(final){
      displayImage(hypothesis);
	}

	document.getElementById('hyp').innerHTML = hypothesis;

};

/*-------------------SETUP AUDIO RECORDING--------------------------*/
PSphinx.prototype.setupAudio = function(){
	//prefixed APIs
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

	var audioContext;

	//instance AudioContext
	try {
		audioContext = new AudioContext();
	}
	catch (e) {
		return console.error('Error Initializing Web Audio');
	}

	var recorder;
	var that = this;

	//callback once the user authorizes access to the mic
	function startUserMedia(stream){
		var input = audioContext.createMediaStreamSource(stream);
		recorder = new AudioRecorder(input);

		//add the recognizer as the consumer
		if(that.m_Recognizer) recorder.consumers.push(that.m_Recognizer);
		if(recorder)that.m_Recorder = recorder;
	}

	//actually call getUserMedia
	if(navigator.getUserMedia){
		navigator.getUserMedia( { audio : true },
								startUserMedia,
								function(e){
									console.error("No live audio input in this browser");
								}
							);
	}
	else {
		console.error("No web audio support in this browser");
	}
};

//CHICKEN : CH  IH K EHN
//MONKEY : M AH N K IY
//DUCK : D AH K