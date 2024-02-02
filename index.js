'use strict'

require('./dependencies/enc-base64-min');
// 音频转码worker
var recorderWorker = require('./dependencies/transformpcm.worker');
// 记录处理的缓存音频
var buffers = [];
var AudioContext = window.AudioContext || window.webkitAudioContext;
var md5 = require('./dependencies/md5');
var CryptoJSNew = require('./dependencies/HmacSHA1');
var CryptoJS = require('./dependencies/hmac-sha256');
var currentUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia

/**
 * 从讯飞语音识别引擎返回参数筛选出识别结果
 * @method setResult
 * @param data 讯飞语音识别引擎返回结果
 * @return number | string  返回值说明 语音识别结果
 */
function setResult(data) {
  var rtasrResult = [];
  rtasrResult[data.seg_id] = data;
  let str = '';
  rtasrResult.forEach(i => {
    if (i.cn.st.type == 0) {
      i.cn.st.rt.forEach(j => {
        j.ws.forEach(k => {
          k.cw.forEach(l => {
            str += l.w
          })
        })
      });
    }
  });
  return str
}

/**
 * 是否函数
 * @param val
 * @returns boolean
 */
function isFunction(val) {
  return typeof val === 'function'
}

/**
 * 是否字符串
 * @param val
 * @returns boolean
 */
function isString(val) {
  return typeof val === 'string'
}

/**
 *
 * @Description: 类说明
 * @method XunFeiVoiceASR
 * @param object config  参数说明 语音助手开启和结束时调用的方法
 * @param Array textData  参数说明 语音指令集合
 * @param string appId  参数说明 讯飞实时语音转写接口appId
 * @param string apiKey  参数说明 讯飞实时语音转写接口apiKey
 */
module.exports = class XunFeiVoiceASR {
  constructor(config, appId, apiKey) {
    this.config = config;
    this.config.onMessage = (message) => {
      var text = setResult(JSON.parse(message));
      if (isFunction(this.config.onResult)) {
        this.config.onResult(text, message)
      }
    };
    this.state = 'end';
    if (!appId || !isString(appId)) {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('appId为空或格式错误');
      }
      throw 'appId为空或格式错误'
    }
    if (!apiKey || !isString(apiKey)) {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('apiKey为空或格式错误');
      }
      throw 'apiKey为空或格式错误'
    }
    this.appId = appId;
    this.apiKey = apiKey;
  }

  start() {
    // this.stop();
    if(this.state === 'ing'){
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('请勿重复开启');
      }
      return false
    }
    if (currentUserMedia && AudioContext) {
      this.state = 'ing';
      if (!this.recorder) {
        const context = new AudioContext();
        this.context = context;
        this.recorder = context.createScriptProcessor(0, 1, 1);
        const getMediaSuccess = (stream) => {
          this.mediaStream = this.context.createMediaStreamSource(stream);
          this.recorder.onaudioprocess = (e) => {
            const voiceData = e.inputBuffer.getChannelData(0);
            this.sendData(voiceData);
            const maxVal = Math.max.apply(Math, voiceData);
            // 显示音量值
            if (isFunction(this.config.onVoiceVolume)) {
              this.config.onVoiceVolume(Math.round(maxVal * 100));
            }
          };
          this.connectWebsocket();
        };
        const getMediaFail = (e) => {
          this.recorder = null;
          this.mediaStream = null;
          this.context = null;
          if (isFunction(this.config.onError)) {
            this.stop();
            this.config.onError('请求麦克风失败',e);
          }
          throw e
        };
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({
              audio: true,
              video: false,
            })
            .then((stream) => {
              getMediaSuccess(stream);
              if (isFunction(this.config.onInitUserMedia)) {
                this.config.onInitUserMedia(stream);
              }
            })
            .catch((e) => {
              getMediaFail(e);
            });
        } else {
          currentUserMedia(
            {
              audio: true,
              video: false,
            },
            (stream) => {
              getMediaSuccess(stream);
            },
            function (e) {
              getMediaFail(e);
            },
          );
        }
      } else {
        this.connectWebsocket();
      }
    } else {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('浏览器不支持');
      }
    }
  }

  stop() {
    this.state = 'end';
      try {
        this.mediaStream.disconnect(this.recorder);
      } catch (e) { }

      try {
        this.recorder.disconnect(this.context.destination);
      } catch (e) { }

      if (isFunction(this.config.onVoiceVolume)) {
        this.config.onVoiceVolume(0);
      }

      setTimeout(()=>{
        if (isFunction(this.config.onClose)) {
          this.config.onClose();
        }
      },256);
  }

  sendData (buffer) {
    var data = {
      command: 'transform',
      buffer: buffer,
    };
    buffers = recorderWorker.onmessage(data) || [];
  };

  // 生成握手参数
  getHandShakeParams() {
    const appId = this.appId;
    const secretKey = this.apiKey;
    const ts = Math.floor(new Date().getTime() / 1000); /* new Date().getTime()/1000+''; */
    const signa = md5.hex_md5(appId + ts); // hex_md5(encodeURIComponent(appId + ts));//EncryptUtil.HmacSHA1Encrypt(EncryptUtil.MD5(appId + ts), secretKey);
    const signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    signature = encodeURIComponent(signature);
    return `?appid=${  appId  }&ts=${  ts  }&signa=${  signature}`;
  }

  connectWebsocket() {
    var url = 'wss://rtasr.xfyun.cn/v1/ws';
    const urlParam = this.getHandShakeParams();

    url = `${url}${urlParam}`;
    if ('WebSocket' in window) {
      this.ws = new WebSocket(url);
    } else if ('MozWebSocket' in window) {
      this.ws = new MozWebSocket(url);
    } else {
      return null;
    }
    this.ws.onopen = (e) => {
      this.mediaStream.connect(this.recorder);
      this.recorder.connect(this.context.destination);
      setTimeout(() => {
        this.wsOpened(e);
      }, 256);
      if(isFunction(this.config.onWebSocketOpen)) {
        this.config.onWebSocketOpen(e);
      }
    };
    this.ws.onmessage = (e) => {
      if (isFunction(this.config.onWebSocketMessage)) {
        this.config.onWebSocketMessage(e);
      }
      setTimeout(()=>{
        this.wsOnMessage(e);
      },64)
    };
    this.ws.onerror = (e) => {
      this.stop();
      if (isFunction(this.config.onWebSocketError)) {
        this.config.onWebSocketError(e);
      }
      if(isFunction(this.config.onError)) {
        this.config.onError('WebSocket连接错误', e);
      }
    };
    this.ws.onclose = (e) => {
      if (isFunction(this.config.onWebSocketClose)) {
        this.config.onWebSocketClose(e);
      }
      this.stop();
    };
  }

  wsOpened() {
    if (this.ws.readyState !== 1) {
      return;
    }
    const audioData = buffers.splice(0, 1280);
    this.ws.send(new Int8Array(audioData));
    this.handlerInterval = setInterval(() => {
      // websocket未连接
      if (this.ws.readyState !== 1) {
        clearInterval(this.handlerInterval);
        return;
      }
      if (buffers.length === 0) {
        if (this.state === 'end') {
          this.ws.send('{"end": true}');
          clearInterval(this.handlerInterval);
        }
        return;
      }
      const voiceData = buffers.splice(0, 1280);
      if (voiceData.length > 0) {
        this.ws.send(new Int8Array(voiceData));
      }
    }, 40);
  }

  wsOnMessage(e) {
    var jsonData = JSON.parse(e.data);
    if (jsonData.action == 'started') {
      // 握手成功
    } else if (jsonData.action == 'result') {
      // 转写结果
      if (isFunction(this.config.onMessage)) {
        this.config.onMessage(jsonData.data);
      }
    } else if (jsonData.action == 'error') {
      // 连接发生错误
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('数据返回错误',e);
      }
      throw jsonData
    }
  }
};
