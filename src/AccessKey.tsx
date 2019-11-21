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

import React, { useState, useEffect, useRef } from 'react';

import Action from "./Action";
import key_img from "./images/key-24px.svg";

export default function AccessKey(props) {
    const dispatch = props.dispatch;
    const label = props.label;
    const accessKey = props.accessKey;

    const [ copying, setCopying ] = useState(false);
    const textboxRef = useRef(null);

    function copy() {
        if (!copying && textboxRef.current) {
            textboxRef.current.select();
            document.execCommand("copy");
            setCopying(true);
        }
    }

    useEffect(() => {
        if (copying) {
            setTimeout(() => {
                if (textboxRef.current) {
                    textboxRef.current.blur();
                }
                setCopying(false);
                dispatch(new Action("setPhase", "showCopyDoneDialogue"));
            }, 200);
        }
    }, [copying]);

    const elms = [];

    elms.push(<button data-testid="access-key-copy" key="access-key-copy" className="access-key-copy-button" onClick={copy} >{label}</button>);

    if (accessKey) {
        elms.push(<input key="access-key-textbox" type="text" className="access-key-textbox" value={accessKey} size={accessKey.length} readOnly={true} ref={textboxRef} ></input>);
        elms.push(<div key="access-key-label" className="access-key-label" >
                    <img className="access-key-icon" src={key_img} />
                    <span data-testid="access-key-text" className="access-key-text" >{accessKey}</span>
                  </div>);
    }

    return (<div data-testid="access-key" className={"access-key" + (accessKey ? " enabled" : "") } >
            {elms}
            </div>);
}

// vim:ft=javascript sw=4
