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
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

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
                            default: "写真をおぼえさせよう",
                            description: "Text message in header."
        })}</div>
        </header>;
}

const IMAGE_SIZE = 224;

const WebCam = (props) => {
    const [ videoSize, setVideoSize ] = useState([320, 240]);

    let stopCallback = null;

    function handleStream(stream) {
        if (props.webcamRef) {
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
        if (navigator.getUserMedia) {
            navigator.getUserMedia({video: true}, handleStream, () => null);
            return () => {
                if (stopCallback) {
                    stopCallback();
                }
            };
        } else {
            return;
        }
    }, []);

    return <div className="webcam-continer">
        <div className="webcam-box-outer">
          <div className="webcam-box-inner">
            <video autoPlay playsInline muted className="webcam" width={videoSize[0]} height={videoSize[1]} onLoadedData={handleVideoSize} ref={props.webcamRef}></video>
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
    return tf.tidy(() => {
        // Reads the image as a Tensor from the webcam <video> element.
        const webcamImage = tf.browser.fromPixels(ref.current);

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
    let canvasRef = null;

    function setCanvasRef(elm) {
        canvasRef = elm;
    }

    const [tensors, setTensors] = props.imageState;

    let handleAddClick = (e) => {
        const image = capture(props.webcamRef);
        drawCanvas(image, canvasRef);
        if (tensors == null) {
            setTensors(tf.keep(image));
        } else {
            const old = tensors;
            setTensors(tf.keep(old.concat(image, 0)));
            old.dispose();
        }
    };

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
          <canvas className="selector-canvas" id={"canvas-" + props.index} width={IMAGE_SIZE} height={IMAGE_SIZE} ref={setCanvasRef} />
        </div>
        <button className="capture-button mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-button--colored" onClick={handleAddClick} >
          <i className="material-icons">add_a_photo</i>
        </button>
    </div>;
}

const Selectors = (props) => {
    let selectors = [];

    useEffect(() => {
        componentHandler.upgradeAllRegistered();
    }, []);

    for (let i = 0; i < MAX_LABELS; i++) {
        selectors.push(<Selector key={i} index={i} webcamRef={props.webcamRef} imageState={props.images[i]} isPredicted={i == props.predicted} />);
    }
    return <div id="selectors">{selectors}</div>
}

const Trainer = (props) => {
    const [ phase, setPhase ] = useState("init");
    const [ loss, setLoss ] = useState(null);
    const [ epoch, setEpoch ] = useState(0);

    async function epochCallback(e, logs) {
        setLoss(logs.loss.toFixed(5));
        setEpoch(e+1);
    }

    useEffect(() => {
        if (phase == "training") {
            componentHandler.upgradeAllRegistered();
        }
        if (phase == "done") {
            let running = true;
            const video = props.webcamRef;
            const fn = () => {
                if (video && video.current) {
                    const image = capture(props.webcamRef);
                    const pred = tf.tidy(() => {
                        const label = props.headNet.predict(props.mobileNet.predict(image)).as1D().argMax();
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

    async function train() {
        setPhase("training");

        /* setup image dataset */
        let xs = null;
        let ys = null;
        for ( let i = 0; i < MAX_LABELS; i++) {
            const tensor = props.images[i][0];
            if (tensor) {
                if (xs == null) {
                    xs = tf.keep(tensor);
                    ys = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                } else {
                    const oldX = xs;
                    const oldY = ys;
                    xs = tf.keep(oldX.concat(tensor, 0));
                    const labels = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                    ys = tf.keep(oldY.concat(labels, 0));
                    oldX.dispose();
                    oldY.dispose();
                    tensor.dispose();
                    labels.dispose();
                }
            }
        }

        /* convert into embeddings tensors */
        const embeddings = props.mobileNet.predict(xs);

        const optimizer = tf.train.adam(0.0001);
        props.headNet.compile({optimizer: optimizer, loss: "categoricalCrossentropy"});
        const batchSize = xs.shape[0];

        const epochs = 40;
        props.headNet.fit(embeddings, ys, {
            batchSize,
            epochs: epochs,
            callbacks: {
                onEpochEnd: epochCallback
            }
        }).then(() => {
            setPhase("done");
        });
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
            const b64 = dataURL.replace(/[^,]*,/, "");
            const spec = {
                "modelmodelTopology": artifacts.modelTopology,
                "weightsManifest": [
                    {
                        "paths": ["weights.bin"],
                        "weights": artifacts.weightSpecs
                    }
                ]
            };
            const json = JSON.stringify(spec);
            // TODO: numbering for certain model and upload to cloud storage
        }
        props.headNet.save(tf.io.withSaveHandler(handleSave)).then(() => {
        });
    }

    if (phase == "init") {
        return <div id="trainer">
              <div>
                <button id="train-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={train} >
                  {formatMessage({
                      id: "train",
                      default: "トレーニング",
                      description: "Text message on train button."
                  })}
                </button>
                </div>
            </div>
    } else if (phase == "training") {
        return <div id="trainer">
              <div className="training-spinner"><div className="mdl-spinner mdl-js-spinner is-active"></div></div>
              <div>Epoch: {epoch}</div>
              <div>Loss: {loss}</div>
            </div>
    } else {
        return <div id="trainer">
              <div>
                <button id="train-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={train} >
                  {formatMessage({
                      id: "train",
                      default: "トレーニング",
                      description: "Text message on train button."
                  })}
                </button>
                </div>
              <div>Epoch: {epoch}</div>
              <div>Loss: {loss}</div>
              <div>
                <button id="save-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={save} >
                  {formatMessage({
                      id: "save",
                      default: "アップロード",
                      description: "Text message on train button."
                  })}
                </button>
              </div>
            </div>
    }
}

const Main = () => {
    const images = [];
    for ( let i = 0; i < MAX_LABELS; i++) {
        images.push(useState(null));
    }

    const [mobileNet, setMobileNet] = useState(null);
    const [headNet, setHeadNet] = useState(null);
    const [predicted, setPredicted] = useState(null);

    useEffect(() => {
        if (mobileNet == null) {
            tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json').then(net => {
                const layer = net.getLayer('conv_pw_13_relu');
                setMobileNet(tf.model({inputs: net.inputs, outputs: layer.output}));
            });
        } else if (headNet == null) {
            setHeadNet(tf.sequential({
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
            }));
        }

        return () => {};
    });

    if (mobileNet && headNet) {
        const webcamRef = React.createRef();
        return <div className="main">
                <WebCam webcamRef={webcamRef} />
                <Selectors webcamRef={webcamRef} images={images} predicted={predicted} />
                <Trainer images={images} mobileNet={mobileNet} headNet={headNet} webcamRef={webcamRef} setPredicted={setPredicted} />
            </div>
    } else {
        return <div className="main"><span className="loading-message">Loading models...</spam></div>
    }
}

const Application = () => {
    const [ started, setStarted ] = useState(false);

    if ( started ) {
        return <div className="root"><Header onClick={() => setStarted(false)} /><Main /></div>;
    } else {
        return <div className="root"><Header onClick={() => setStarted(true)} /></div>;
    }
}

ReactDOM.render(<Application />, document.getElementById('app'));

// vim:ft=javascript sw=4
