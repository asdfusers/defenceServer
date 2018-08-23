
exports.Queue = function(){
    this.dataStore = [];
    this.enqueue = enqueue;
    this.dequeue = dequeue;
    this.front = front;
    this.back = back;
    this.toString = toString;
    this.empty = empty;
  }
  
 function enqueue(element){
    //여기서 push함수는 Array의 내장함수이다.
    //요소를 배열 맨 뒤에 삽입.
    this.dataStore.push(element);
  }
  
function dequeue(){
    //shift는 Array의 내장함수이다. 
    //배열내의 맨 앞 요소를 반환하고 배열내에서 삭제한다.
    return this.dataStore.shift();
  }
  
  //큐의 맨 젓번째 요소 반환
  function front(){
  
    //배열의 첫번째 요소 반환
    return this.dataStore[0];
  }
  
  
  //큐의 맨 끝 요소 반환
  function back(){
  
    //배열의 맨 끝 요소 반환
    return this.dataStore[this.dataStore.length-1];
  }
  
  
  //큐에 저장된 요소 모두 출력
  function toString(){
    var retStr="";
    for(var i=0; i<this.dataStore.length; i++)
    {
        retStr=retStr + this.dataStore[i] + "\n";
    }
    return retStr;
  }
  
  //큐 비우기
 function  empty(){
    if(this.dataStore.length==0){
        return true;
    }
    else{
        return false;
    }
  }