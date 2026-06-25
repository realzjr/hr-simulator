// HR模拟器 - 数据加载器 (按 JD 懒加载，替代原 784KB 大文件)

var LOCAL_DATA = {};

var LDS = {
  _loaded: {},
  
  load: function(jdIndex) {
    var self = this;
    if (self._loaded[jdIndex]) return Promise.resolve(LOCAL_DATA[jdIndex]);
    
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'data/localData_' + jdIndex + '.js';
      s.onload = function() {
        LOCAL_DATA[jdIndex] = window['LOCAL_DATA_' + jdIndex];
        delete window['LOCAL_DATA_' + jdIndex];
        self._loaded[jdIndex] = true;
        resolve(LOCAL_DATA[jdIndex]);
      };
      s.onerror = function() {
        reject(new Error('Failed to load JD' + jdIndex + ' data'));
      };
      document.head.appendChild(s);
    });
  },
  
  preloadAll: function() {
    for (var i = 0; i < 3; i++) {
      setTimeout(function(idx) { LDS.load(idx); }, idx * 300, i);
    }
  }
};
