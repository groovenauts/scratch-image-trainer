/**
 * @license
 * Copyright 2018 Groovenauts, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tf from '@tensorflow/tfjs';

import formatMessage from "format-message";
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import fetch from 'node-fetch';

const postURL = "https://magellan-file-webcamdata-dot-ai-for-edu.appspot.com/upload";
const accessKey = process.env.UPLOAD_TOKEN;

let translations = {
  "ja": {
    "headerMessage": "スクラッチに写真をおぼえさせよう!",
    "train": "トレーニング",
  },
  "en": {
    "headerMessage": "Teach scratch with photos!",
    "train": "Train",
  }
};

formatMessage.setup({
    locale: "ja-JP",
    translations: translations,
    missingTranslation: "ignore",
});

const MAX_LABELS = 10;

const Header = (props) => {
    return <header onClick={props.onClick} >
        <div>{formatMessage({
                            id: "headerMessage",
                            default: "スクラッチに写真をおぼえさせよう!",
                            description: "Text message in header."
        })}</div>
        </header>;
}

const IMAGE_SIZE = 224;

const WebCam = (props) => {
    const [ videoSize, setVideoSize ] = useState([320, 240]);

    let stopCallback = null;

    function handleStream(stream) {
        if (props.webcamRef.current) {
            props.webcamRef.current.srcObject = stream;
            stopCallback = () => {
                stream.getVideoTracks().forEach((tr) => { tr.stop(); });
            }
        }
    }

    function handleVideoSize() {
        const elm = props.webcamRef.current;
        const aspectRatio = elm.videoWidth / elm.videoHeight;
        let newSize = [IMAGE_SIZE, IMAGE_SIZE];
        if (aspectRatio >= 1) {
            newSize = [Math.ceil(IMAGE_SIZE * aspectRatio), IMAGE_SIZE];
        } else {
            newSize = [IMAGE_SIZE, Math.ceil(IMAGE_SIZE * aspectRatio)];
        }
        if (videoSize[0] !== newSize[0] || videoSize[1] !== newSize[1]) {
            setVideoSize(newSize);
        }
    }

    useEffect(() => {
        const navigatorAny = navigator;
        navigator.getUserMedia = navigator.getUserMedia ||
            navigatorAny.webkitGetUserMedia || navigatorAny.mozGetUserMedia ||
            navigatorAny.msGetUserMedia;
        if (props.videoFlag && navigator.getUserMedia) {
            navigator.getUserMedia({video: true}, handleStream, () => null);
            return () => {
                if (stopCallback) {
                    stopCallback();
                }
            };
        } else {
            return;
        }
    }, [props.videoFlag]);

    let onClick = null;
    if (!props.videoFlag) {
        onClick = () => {
            props.setVideoFlag(true)
        }
    }

    return <div className="webcam-continer">
        <div className="webcam-box-outer">
          <div className="webcam-box-inner">
            <video autoPlay playsInline muted className="webcam" width={videoSize[0]} height={videoSize[1]} onLoadedData={handleVideoSize} ref={props.webcamRef} onClick={onClick} ></video>
          </div>
        </div>
      </div>
}

function cropImage(img) {
    const size = Math.min(img.shape[0], img.shape[1]);
    const centerHeight = img.shape[0] / 2;
    const beginHeight = centerHeight - (size / 2);
    const centerWidth = img.shape[1] / 2;
    const beginWidth = centerWidth - (size / 2);
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
}

function capture(ref) {
    const video = ref.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.width;
    canvas.height = video.height;
    const context = canvas.getContext("2d");
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return tf.tidy(() => {
        // Reads the image as a Tensor from the webcam <video> element.
        const webcamImage = tf.browser.fromPixels(canvas);

        // Crop the image so we're using the center square of the rectangular
        // webcam.
        const croppedImage = cropImage(webcamImage);

        // Expand the outer most dimension so we have a batch size of 1.
        const batchedImage = croppedImage.expandDims(0);

        // Normalize the image between -1 and 1. The image comes in between 0-255,
        // so we divide by 127 and subtract 1.
        const offset = tf.scalar(127.5);
        return batchedImage.toFloat().sub(offset).div(offset);
    });
}

function drawCanvas(image, canvasRef) {
    const [width, height] = [IMAGE_SIZE, IMAGE_SIZE];
    const ctx = canvasRef.getContext('2d');
    const imageData = new ImageData(width, height);
    const data = image.dataSync();
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const j = ((width-1-x) + y * width) * 4;
            imageData.data[j + 0] = (data[(y * width + x) * 3 + 0] + 1) * 127;
            imageData.data[j + 1] = (data[(y * width + x) * 3 + 1] + 1) * 127;
            imageData.data[j + 2] = (data[(y * width + x) * 3 + 2] + 1) * 127;
            imageData.data[j + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

const Selector = (props) => {
    const [capturing, setCapturing] = useState(false);
    const canvasRef = useRef();

    const [tensors, setTensors] = props.imageState;

    useEffect(() => {
        const addSample = () => {
            const image = capture(props.webcamRef);
            drawCanvas(image, canvasRef.current);
            const embedding = tf.tidy(() => props.mobileNet.predict([image]));
            image.dispose();
            if (tensors == null) {
                setTensors(embedding);
            } else {
                // previous tensor will disposed via useEffect() cleanup in Main components.
                const newTensors = tf.tidy(() => tf.concat([tensors, embedding], 0));
                embedding.dispose();
                setTensors(newTensors);
            }
        }

        if (capturing) {
            setTimeout(addSample, 200);
        }
    }, [capturing, tensors]);

    const toggleCapturing = () => {
        setCapturing(!capturing);
    }

    const badge;
    if (tensors == null) {
        badge = null;
    } else {
        badge = tensors.shape[0];
    }

    return <div className={"selector-cell" + (props.isPredicted ? " predicted" : "")} >
        <div className="selector-label" >
          <span className="mdl-chip" ><span className="mdl-chip__text">{ props.index + 1 }</span></span>
        </div>
        <div className="mdl-badge mdl-badge--overlap" data-badge={badge} >
          <canvas className="selector-canvas" id={"canvas-" + props.index} width={IMAGE_SIZE} height={IMAGE_SIZE} ref={canvasRef} />
        </div>
        <button className="capture-button mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-button--colored" onClick={toggleCapturing} >
          { capturing ?
              <i className="material-icons">stop</i> :
              <i className="material-icons">add_a_photo</i> }
        </button>
    </div>;
}

const Selectors = (props) => {
    let selectors = [];

    useEffect(() => {
        componentHandler.upgradeAllRegistered();
    }, []);

    for (let i = 0; i < MAX_LABELS; i++) {
        selectors.push(<Selector key={i} index={i} webcamRef={props.webcamRef} imageState={props.images[i]} isPredicted={i == props.predicted} mobileNet={props.mobileNet} />);
    }
    return <div id="selectors">{selectors}</div>
}

const Trainer = (props) => {
    const [headNet, setHeadNet] = useState(null);
    const [ phase, setPhase ] = useState("init");
    const [ loss, setLoss ] = useState(null);
    const [ epoch, setEpoch ] = useState(0);
    const [ modelKey, setModelKey ] = useState(null);

    async function epochCallback(e, logs) {
        setLoss(logs.loss.toFixed(5));
        setEpoch(e+1);
    }

    useEffect(() => {
        if (phase == "training" || phase == "uploading") {
            componentHandler.upgradeAllRegistered();
        }
        if (phase == "done" || (phase == "uploaded" && props.videoFlag)) {
            let running = true;
            const video = props.webcamRef;
            const fn = () => {
                if (video && video.current) {
                    const image = capture(props.webcamRef);
                    const pred = tf.tidy(() => {
                        const label = headNet.predict(props.mobileNet.predict(image)).as1D().argMax();
                        return label;
                    });
                    props.setPredicted(pred.dataSync()[0]);
                    image.dispose();
                    pred.dispose();
                }
                if (running) {
                    setTimeout(fn, 200);
                }
            }
            let tid = setTimeout(fn, 200);
            return () => {
                running = false;
                clearTimeout(tid);
            }
        }
    });

    function train() {
        setPhase("training");

        setTimeout(() => {
            /* setup image dataset */
            let xs = null;
            let ys = null;
            for ( let i = 0; i < MAX_LABELS; i++) {
                const tensor = props.images[i][0];
                if (tensor) {
                    if (xs == null) {
                        xs = tf.clone(tensor);
                        ys = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                    } else {
                        const oldX = xs;
                        const oldY = ys;
                        xs = oldX.concat(tensor, 0);
                        const labels = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                        ys = oldY.concat(labels, 0);
                        oldX.dispose();
                        oldY.dispose();
                        labels.dispose();
                    }
                }
            }

            if (xs == null){
                setPhase("init");
                return
            }

            const net = tf.sequential({
                                      layers: [
                                          tf.layers.flatten({inputShape: [7,7,256]}),
                                          tf.layers.dense({
                                                          units: 100,
                                                          activation: "relu",
                                                          kernelInitializer: "varianceScaling",
                                                          useBias: true
                                          }),
                                          tf.layers.dense({
                                                          units: MAX_LABELS,
                                                          kernelInitializer: "varianceScaling",
                                                          useBias: false,
                                                          activation: "softmax"
                                          })
                                      ]
            });

            const optimizer = tf.train.adam(0.0001);
            net.compile({optimizer: optimizer, loss: "categoricalCrossentropy"});
            const batchSize = xs.shape[0];

            const epochs = 50;
            net.fit(xs, ys, {
                batchSize,
                epochs: epochs,
                callbacks: {
                    onEpochEnd: epochCallback
                }
            }).then(() => {
                xs.dispose();
                ys.dispose();
                optimizer.dispose();
                if (headNet) { headNet.dispose();}
                setHeadNet(net);
                setPhase("done");
            });
        }, 10);
    }

    function save() {
        async function handleSave(artifacts) {
            const weightBlob = new Blob([artifacts.weightData], { type: "application/octet-stream"} );
            const reader = new FileReader();
            function fn() {
                return new Promise((resolve, reject) => {
                    reader.onerror = () => {
                        reader.abort();
                        reject(new DOMException("Can't load model weights binary."));
                    };
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.readAsDataURL(weightBlob);
                });
            }
            const dataURL = await fn();
            const b64 = dataURL.replace(/^[^,]*,/, "");
            const spec = {
                "modelTopology": artifacts.modelTopology,
                "weightsManifest": [
                    {
                        "paths": ["weights.bin"],
                        "weights": artifacts.weightSpecs
                    }
                ]
            };
            const json = JSON.stringify(spec);

            function upload(filename, b64_content) {
                return new Promise((resolve, reject) => {
                    const req = "key=" + accessKey + "&filename=" + filename + "&content=" + b64_content.replace(/\+/g, "%2b");
                    window.fetch(postURL, {headers: { "content-type": "application/x-www-form-urlencoded" }, body: req, method: "POST", mode: "no-cors" })
                        .then(res => resolve())
                        .catch(error => {
                            console.log("POST model failed(" + filename + "): " + error)
                            setPhase("done");
                            reject();
                        });
                });
            }

            const id = ("00000000" + Math.floor((Math.random()*10000000))).slice(-7);
            const dir = "models/image-detection/v1/" + id;

            await upload(dir + "/weights.bin", b64);
            await upload(dir + "/model.json", btoa(json));
            setModelKey(id);
        }
        setPhase("uploading");
        setTimeout(() => {
            headNet.save(tf.io.withSaveHandler(handleSave)).then(() => {
                setPhase("uploaded");
                props.setVideoFlag(false);
            });
        }, 10);
    }

    const elms = [];

    if (phase == "init" || phase == "done" || phase == "uploaded") {
        elms.push(<div key="train-button" ><button id="train-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={train} >
                  {formatMessage({
                                 id: "train",
                                 default: "トレーニング",
                                 description: "Text message on train button."
                  })}
                  </button></div>);
    }
    if (phase == "training" || phase == "uploading") {
        elms.push(<div key="spinner" className="training-spinner"><div className="mdl-spinner mdl-js-spinner is-active"></div></div>);
    }
    if (phase == "training" || phase == "done" || phase == "uploading" || phase == "uploaded") {
        elms.push(<div key="epoch" >Epoch: {epoch}</div>);
        elms.push(<div key="loss" >Loss: {loss}</div>);
    }
    if (phase == "done") {
        elms.push(<div key="save-button" >
                    <button id="save-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={save} >
                      {formatMessage({
                          id: "save",
                          default: "アップロード",
                          description: "Text message on upload button."
                      })}
                    </button>
                  </div>);
    }
    if (phase == "uploaded") {
        elms.push(<div key="model-key" >カギをゲットした: <span>{modelKey}</span></div>);
    }

    return <div id="trainer">
        {elms}
        </div>
}

const Main = (props) => {
    const images = [];
    for ( let i = 0; i < MAX_LABELS; i++) {
        images.push(useState(null));
    }

    const [predicted, setPredicted] = useState(null);
    const [videoFlag, setVideoFlag] = useState(true);

    const webcamRef = useRef(null);

    for ( let i = 0; i < MAX_LABELS; i++ ) {
        useEffect(() => {
            return () => {
                if (images[i][0]) {
                    images[i][0].dispose();
                }
            };
        }, [images[i][0]]);
    }

    if (props.mobileNet) {
        return <div className="main">
                <WebCam webcamRef={webcamRef} videoFlag={videoFlag} setVideoFlag={setVideoFlag} />
                <Selectors webcamRef={webcamRef} mobileNet={props.mobileNet} images={images} predicted={predicted} />
                <Trainer images={images} mobileNet={props.mobileNet} webcamRef={webcamRef} setPredicted={setPredicted} videoFlag={videoFlag} setVideoFlag={setVideoFlag} />
            </div>
    } else {
        return <div className="main"><span className="loading-message">Loading models...</spam></div>
    }
}

const Application = () => {
    const [ started, setStarted ] = useState(false);
    const [mobileNet, setMobileNet] = useState(null);

    useEffect(() => {
        let rootNet = null;
        if (mobileNet == null) {
            tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json').then(net => {
                rootNet = net;
                const layer = net.getLayer('conv_pw_13_relu');
                const truncatedNet = tf.model({inputs: net.inputs, outputs: layer.output});
                // warm up;
                tf.tidy(() => {
                    truncatedNet.predict(tf.zeros([1, 224, 224, 3]));
                });
                setMobileNet(truncatedNet);
            });
        }

        return () => {
            if (rootNet) {
                rootNet.dispose();
            }
        };
    }, []);

    if ( started ) {
        return <div className="root"><Header onClick={() => setStarted(false)} /><Main mobileNet={mobileNet} /></div>;
    } else {
        return <div className="root"><Header onClick={() => setStarted(true)} /></div>;
    }
}

ReactDOM.render(<Application />, document.getElementById('app'));

// vim:ft=javascript sw=4
