
module.exports = class Evaluation {
    constructor({
        serviceAhj,
        definitions,
        conditions,
        rules
    }) {
        this._serviceAhj = serviceAhj;
        this._definitions = definitions;
        this._conditions = conditions;
        this._rules = rules;
        this._appliedRules = JSON.parse(JSON.stringify(serviceAhj.rules));
        this._errors = null;
        this._timeStamp = new Date();
        this._evaluationType = undefined;
    }
    set conditions(conditions) {
        this._conditions = conditions;
        this.validateConditions()
    }
    clearConditions(){
        this._conditions = undefined;
        this.validateConditions()
    }
    clearRules(){
        this._rules = undefined;
        this.validateRules();
    }
    get conditions(){
        return this._conditions;
    }
    set rules(rules) {
        this._rules = rules;
        this.validateRules();
    }
    get validatedRules(){
        const appliedRules = Object.keys(this._appliedRules);
        if(this._rules) return this._rules.filter(id=>{return appliedRules.includes(id) })
    }
    get rules(){
        return this._rules;
    }
    get serviceAhj(){
        return this._serviceAhj;
    }
    get appliedRulesDetail(){
        return this._appliedRules;
    }
    get appliedRules(){
        return Object.keys(this._appliedRules);
    }
    get appliedConditionsMap(){
        const rules = this.validatedRules||Object.keys(this._definitions.conditions);
        return Object.assign({},
            ...rules.map(id=>{
                const appliedConditions = this._appliedConditions(id);
                if(appliedConditions) return {[id]:appliedConditions};
                return {};
            })
        )
    }
    get appliedConditions(){
        if(!this.validatedRules) return Object.keys(this._definitions.conditions);
        return this.flatten(this.validatedRules.map(id=>{
            return this._appliedConditions(id)
        }));
    }
    get errorsMap(){
        return (this._errors)?this._errors.map:this._errors;
    }
    get errors(){
        return (this._errors)?this._errors.list:this._errors;
    }
    exceptions(){
        this._evaluationType = 'exceptions';
        this.validateRules();
        this.parseRules();
        return this._serviceAhj;
    }
    evaluate(){
        this._evaluationType = 'evaluate';
        this.validateConditions();
        this.validateRules();
        this.parseRules();
        return this._serviceAhj;
    }
    flatten(array){
        let flat = [];
        array.map(a=>{if(a) flat = [...flat,...a]});
        return flat;
    }
    _appliedConditions(id){
        let appliedConditions;
        const rule = this._appliedRules[id];
        rule.statements.map(statement=>{
            if(statement.condition){
                if(!appliedConditions) appliedConditions = [];
                statement.condition.map(condition=>{
                    if(!appliedConditions.includes(condition.left)) appliedConditions.push(condition.left)
                })
            }
        });
        return appliedConditions;
    }
    cleanUpErrors(ids){
        if(ids){
            ids.map(id=>{
                if( this._errors && this._errors.map[id] ){
                    this._errors.map[id].filter(error=>{return error.timeStamp === this._timeStamp});
                    this._errors.list.map(error=>{return error.id!==id||error.timeStamp === this._timeStamp});
                    if(this._errors.map[id].length === 0) this._errors.map[id] = undefined;
                    if(this._errors.list.length === 0 ) this._errors = undefined;
                }
            })
        }
    }
    addError(id,message,type){
        if(message==='clear') this._errors = null;
        else {
            const timeStamp = this._timeStamp;
            if(!this._errors) this._errors = {list:[],map:{}};
            if(!this._errors.map[id]) this._errors.map[id] = [];
            this._errors.map[id].push({id,message,timeStamp,type});
            this._errors.list.push({id,message,timeStamp,type});
        }
    }
    validateRules(){
        this._timeStamp = new Date();
        this.cleanUpErrors(this._rules);
        if(this._rules){
            this._rules.map(id=>{
                if(!this._definitions.listAll.rules.includes(id)){
                    this.addError(id,`Invalid Rule Provided, Rule Not Found: ${ id }`,'invalidRule')
                }
            })
        }
    }
    validateConditions(){
        this._timeStamp = new Date();
        const appliedConditions = this.appliedConditions;
        const conditionInputs = Object.keys(this._conditions||{});
        this.cleanUpErrors([...appliedConditions,...conditionInputs]);
        conditionInputs.map(id=>{
            if(!this._definitions.listAll.conditions.includes(id)){
                this.addError(id,`Invalid Condition Provided, Condition Not Found: ${ id }`,'invalidCondition')
            }
        });
        appliedConditions.map(appliedCondition=>{
            if(!conditionInputs.includes(appliedCondition)){
                this.addError(appliedCondition,`Condition Input Missing: ${ appliedCondition }`,'missingCondition');
            }
        })
    }
    calculator (input,operator,curRight) {
        const calculate = {
            "=":(input,curRight)=>{return input === curRight},
            ">":(input,curRight)=>{return input > curRight},
            "<":(input,curRight)=>{return input < curRight},
            "!=":(input,curRight)=>{return input !== curRight},
            ">=":(input,curRight)=>{return input >= curRight},
            "<=":(input,curRight)=>{return input <= curRight}
        };
        return calculate[operator](input,curRight);
    };
    evaluateConditions(conditions){
        if(!conditions) return true;
        if(!this._conditions) return false;
        const evaluation = conditions.map(condition=>{
            const { left, operator, right} = condition;
            const input = this._conditions[left];
            return this.calculator(input,operator,right);
        });
        return !evaluation.includes(false)
    }
    objectDescriptions(statements,descriptions){
        statements.map(statement=>{
            if(statement.description){
                if(!descriptions) descriptions = {};
                Object.keys(statement.value).map(key=>{
                    let description = statement.description;
                    if(!descriptions[key])descriptions[key]=[];
                    if(description.indexOf(statement.value[key])<0)description = `${key.toUpperCase()}: ${statement.value[key]}, ${description}`;
                    descriptions[key].push(description);
                });
            }
        });
        return descriptions
    }
    mergeStatements(id,statements, defaultSource){
        let obj, val, conditions, description, source;
        const { dataType } = this._definitions.rules[id].template;
        if(dataType==='object') obj = {};
        statements.map(statement=>{
            const { value, condition } = statement;
            if(condition)conditions = [...conditions||[], ...condition];
            if(obj) Object.assign(obj, value);
            description = statement.description;
            val = value;
            source = statement.source;
        });
        return Object.assign(
            description?{description}:{},
            conditions?{conditions}:{},
            {value: obj||val},
            { source: source||defaultSource }
        );
    }
    createMap(items){
        return Object.assign({},
            ...items.map(item=>{
                return {[item.id]:item}
            })
        )
    }
    swapReferenceIds(statement,id){
        const { template } = this._definitions.rules[id];
        if(template.items)Object.assign(template, {itemsMap:this.createMap(template.items)});
        if(template.dataType==='ordered list'){
            statement.value = statement.value.map(id=>{
                return template.itemsMap[id]
            })
        }
        if(template.dataType==='enum'){
            statement.value = template.itemsMap[statement.value].name;
        }
    }
    parseStatements(id, appliedRule){
        let descriptions, defaultSource;
        const { statements, timeStamp } = appliedRule;
        const { dataType } = this._definitions.rules[id].template;

        const evaluated = statements.filter(statement=>{
            this.swapReferenceIds(statement,id);
            if( this._evaluationType==='exceptions' && statement.description ){
                if(!descriptions) descriptions = [];
                descriptions.push(statement.description);
            }
            defaultSource = statement.source;
            return this.evaluateConditions(statement.condition)
        });
        if( dataType==='object' && this._evaluationType === 'exceptions' ){
            descriptions = this.objectDescriptions(statements)
        }
        return Object.assign(
            descriptions ? { descriptions } : {},
            timeStamp ? { timeStamp } : {},
            this.mergeStatements(id, evaluated, defaultSource)
        )

    }
    parseRules(){
        const rules = this.validatedRules||Object.keys(this._appliedRules);
        rules.map(id=>{
            if(id){
                const appliedRule = this._appliedRules[id];
                this._serviceAhj.rules[id] = this.parseStatements(id,appliedRule);
            }
        });
    }
};
