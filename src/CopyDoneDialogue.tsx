/**
 * @license
 * Copyright 2019 Groovenauts, Inc. All Rights Reserved.
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

import formatMessage from "format-message";
import React from 'react';

import Action from "./Action";

export default function CopyDoneDialogue(props) {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;
    const show = props.show;
    const text1 = formatMessage({ id: "copyDoneDialogue1",
                                   default: "コピーしました",
                                   description: "Text message on copy done dialogue."});
    const closeLabel = formatMessage({ id: "close",
                                      default: "とじる",
                                      description: "Text message on close button."});

    const maskClasses = [ "dialogue-mask" ];

    if (show) {
        maskClasses.push("visible");
    }

    const close = () => {
        dispatch(new Action("setPhase", "done"));
    };

    return <div key="dialogue-mask" className={maskClasses.join(" ")} >
        <div key="dialogue" className="dialogue" >
          <span>{text1}</span>
          <button className="close-button" onClick={close} >{closeLabel}</button>
        </div>
      </div>;
}

// vim:ft=javascript sw=4