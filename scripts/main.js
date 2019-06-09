// Queries the container in which the remote feeds belong
let remoteContainer= document.getElementById("video");
let $msgContainer = $('#scrollWrap');
let remoteMinimized = document.getElementById("minimized-remote");
let remotes=[];
let url = 'https://protected-temple-29748.herokuapp.com/';
let broadcaster = localStorage.getItem('broadcaster')==='true';
let ref = database.ref(`${localStorage.getItem('app')}/${localStorage.getItem('room')}/messages`);
let $msgBox = $('#typeMsg');
let $send = $('#send');
let $raise = $('#raise-hand');
let $deesc = $('#de-escalate');
let $pa = $('#privileged-audience .collection');
let localStream;

/**
 * @name handleFail
 * @param err - error thrown by any function
 * @description Helper function to handle errors
 */
let handleFail = function(err){
    console.log("Error : ", err);
};

/**
 * @name addVideoStream
 * @param streamId
 * @description Helper function to add the video stream to "remote-container"
 */
function addVideoStream(streamId){
    remotes.push(streamId);
    let streamDiv=document.createElement("div"); // Create a new div for every stream
    streamDiv.id=String(streamId);                       // Assigning id to div
    streamDiv.style.transform="rotateY(180deg)"; // Takes care of lateral inversion (mirror image)
    if (remotes.length>1){
        streamDiv.className="minimized-video video-margin";
        remoteMinimized.appendChild(streamDiv);      // Add new div to container
    }
    else {
        streamDiv.style.height = '100%';
        remoteContainer.appendChild(streamDiv);      // Add new div to container
    }
}

/**
 * @name removeVideoStream
 * @param evt - Remove event
 * @description Helper function to remove the video stream from "remote-container"
 */
function removeVideoStream (evt) {
    console.log("remove video-stream called");
    let stream = evt.stream;
    if(stream){
        stream.close();
        remotes = remotes.filter(e => e!==stream.getId());
        // console.log('remove ',stream.getId(), remotes);
        let remDiv=document.getElementById(stream.getId());
        remDiv.parentNode.removeChild(remDiv);
        console.log("Remote stream is removed " + stream.getId());
    }
}

function publish(uid){
    // Stream object associated with your web cam is initialized
    localStream = AgoraRTC.createStream({
        streamID: uid,
        audio: true,
        video: broadcaster,
        screen: false
    });

    // Associates the stream to the client
    localStream.init(function() {

        //Plays the localVideo
        localStream.play('me');

        //Publishes the stream to the channel
        client.publish(localStream, handleFail);

    },handleFail);
}
const out = $msgContainer[0];
function addMsg(data){
    let msg = data.val();
    console.log("message from" , msg.uid , localStorage.getItem('uid'));
    const isScrolledToBottom = out.scrollHeight - out.clientHeight <= out.scrollTop + 1;
    $msgContainer.append(`
        <div class="messageWrap">
            <div style="" class="message ${(msg.uid === localStorage.getItem('uid'))?'user':'bot'}">
                <span class="message-text">
                    ${msg.name}<hr>
                    ${msg.message}
                </span>
                <div class="triangle"></div>
            </div>
        </div>
    `);
    if (isScrolledToBottom) {
        out.scrollTop = out.scrollHeight - out.clientHeight
    }
}

// Client Setup
// Defines a client for RTC
let client = AgoraRTC.createClient({
    mode: 'live',
    codec: "h264"
});
if(broadcaster){
    $raise.hide();
    $deesc.hide();
}
else{
    $('#me').css({
        'display':'none'
    });
    $('#mute-video,#mute-audio').addClass('disabled');
    $deesc.addClass('disabled');
}
function unpublish(){
    client.unpublish(localStream,handleFail);
    localStream.close();
}
function leave(){
    client.leave(function() {
        if (broadcaster)
            localStream.close();
        localStorage.clear();
        window.location='./index.html';
    },handleFail);
}
function removePrivileged(id){
    $.ajax({
        url:"https://protected-temple-29748.herokuapp.com/delete",
        type:"POST",
        data:{
            uid:id,
            channel:localStorage.getItem('room'),
            app:localStorage.getItem('app')
        },
        success:(d)=>{
            console.log(d);
            if(broadcaster)M.toast({html: 'Privilege de-escalated!'});
        }
    });
}
function grantPrivilege(id) {
    $.ajax({
        url:"https://protected-temple-29748.herokuapp.com/accept",
        type:"POST",
        data:{
            uid:id,
            channel:localStorage.getItem('room'),
            app:localStorage.getItem('app')
        },
        success:(d)=>{
            console.log(d);
            $(`#privim${id}`).removeClass('greyed-out');
            $(`#done${id}`).addClass('disabled greyed-out');
            M.toast({html: 'Privilege escalated!'});
        }
    });
}
function addPrivileged(uid,details){
    $pa.append(`
        <li id="priv${uid}" class="collection-item avatar">
            <img id="privim${uid}" src="images/letters/${details.name[0].toUpperCase()}.png" alt="" class="circle greyed-out">
            <span class="title hover">${details.name}</span>
            <a href="#!" class="secondary-content hover"><i id="done${uid}" onclick="grantPrivilege(${uid});" class="material-icons">done</i><i onclick="removePrivileged(${uid});" class="material-icons red-text">close</i></a>
        </li>
    `);
}
// Client Setup
// Defines a client for Real Time Communication
client.init(localStorage.getItem('app'),() => console.log("AgoraRTC client initialized") ,handleFail);

// The client joins the channel
client.join(null,localStorage.getItem('room'),localStorage.getItem('uid'), (uid)=>{
    localStorage.setItem('uid',uid);
    ref.on('child_added', addMsg);
    $.ajax({
        url:"https://protected-temple-29748.herokuapp.com/auth",
        type:"POST",
        data:{
            name:localStorage.getItem('user'),
            uid:localStorage.getItem('uid'),
            broadcaster:broadcaster,
            channel:localStorage.getItem('room'),
            app:localStorage.getItem('app')
        }
    }).then((data)=>{
        console.log('User added to db',data);
        if(!broadcaster){
            let pref = database.ref(`${localStorage.getItem('app')}/${localStorage.getItem('room')}/privilege/${localStorage.getItem('uid')}/accepted`);

            pref.on('value', function(snapshot) {
                let pstat = snapshot.val();
                console.log("privilege value - ",pstat);
                if(pstat==="true"){
                    publish(localStorage.getItem('uid'));
                    $raise.addClass('disabled');
                    $deesc.removeClass('disabled').click(()=>removePrivileged(localStorage.getItem('uid')));
                    $('#mute-audio').removeClass('disabled dbl').click(function () {
                        if(!$(this).hasClass('dbl')){
                            $(this).addClass('dbl');
                            localStream.muteAudio();
                            $(this).children('.material-icons').html('mic_off');
                        }
                        else {
                            $(this).removeClass('dbl');
                            localStream.unmuteAudio();
                            $(this).children('.material-icons').html('mic');
                        }
                    }).children('.material-icons').html('mic');
                    M.toast({html: 'Privilege escalated, now connecting voice channel!'});
                    console.log("privilege escalated!");
                }
                else if (pstat ==="false"){
                    $raise.addClass('disabled');
                    M.toast({html: 'Privilege escalation requested!'});
                    console.log('Privilege escalation requested!');
                }
                else if (pstat===null){
                    if (localStream){
                        $raise.removeClass('disabled');
                        $deesc.addClass('disabled');
                        $('#mute-audio').addClass('disabled').off();
                        unpublish();
                        M.toast({html: 'Privilege de-escalated!'});
                        console.log("privilege de-escalated / Request denied!");
                    }
                    console.log("No privilege set!")
                }
            });
        }
    });
    if(broadcaster)
        publish(uid);

},handleFail);

//When a stream is added to a channel
client.on('stream-added', function (evt) {
    client.subscribe(evt.stream, handleFail);
});
//When you subscribe to a stream
client.on('stream-subscribed', function (evt) {
    let stream = evt.stream;
    addVideoStream(stream.getId());
    stream.play(String(stream.getId()));
});
//When a person is removed from the stream
client.on('stream-removed',removeVideoStream);
client.on('peer-leave',removeVideoStream);

$(document).ready(function(){

    $('.sidenav').sidenav({
        edge: 'right'
    });
    $('#leave-call').click(function () {
        leave();
    });
    $('.tooltipped').tooltip();
    $msgBox.keypress(function(event){
        let keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode === 13){
            console.log("enter pressed");
            $send.click();
        }
    });
    $send.click(function () {
        let val = $msgBox.val();
        $.ajax({
            url:"https://protected-temple-29748.herokuapp.com/post",
            type:"POST",
            data:{
                uid:localStorage.getItem('uid'),
                message:val,
                channel:localStorage.getItem('room'),
                app:localStorage.getItem('app')
            },
            success:(d)=>console.log(d)
        });
        $msgBox.val('');
    });

    if(broadcaster){
        $('#mute-audio').click(function () {
            if(!$(this).hasClass('dbl')){
                $(this).addClass('dbl');
                localStream.muteAudio();
                $(this).children('.material-icons').html('mic_off');
            }
            else {
                $(this).removeClass('dbl');
                localStream.unmuteAudio();
                $(this).children('.material-icons').html('mic');
            }
        });
        $('#mute-video').click(function () {
            if(!$(this).hasClass('dbl')){
                $(this).addClass('dbl');
                localStream.muteVideo();
                $('#me').hide();
                $(this).children('.material-icons').html('videocam_off');
            }
            else {
                $(this).removeClass('dbl');
                localStream.unmuteVideo();
                $('#me').show();
                $(this).children('.material-icons').html('videocam');
            }
        });
        database.ref(`${localStorage.getItem('app')}/${localStorage.getItem('room')}/privilege`).on('child_added',function (snapshot) {
            console.log(snapshot.val());
            addPrivileged(snapshot.key,snapshot.val());
        });
        database.ref(`${localStorage.getItem('app')}/${localStorage.getItem('room')}/privilege`).on('child_removed',function (snapshot) {
            $(`#priv${snapshot.key}`).remove();
        });
    }
    else {
        $raise.click(function () {
            $.ajax({
                url:url+"add",
                type:"POST",
                data:{
                    uid:localStorage.getItem('uid'),
                    channel:localStorage.getItem('room'),
                    app:localStorage.getItem('app')
                },
                success:function (data) {
                    console.log("privilege escalation" ,data);
                }
            })
        });
    }
});