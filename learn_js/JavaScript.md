#### JavaScript

* ECMAScrpit：核心语法知识点
* Web APIs
  * DOM：操作文档【内容
  * BOM ：操作浏览器【形式

书写位置：

* 内部
  * </body>上方
  * 这样页面可以从上往下加载，保证scipt有对象可以用
* 外部【推荐】
  * 写在html外部
  * 外部和内部不可以混用
* 内联【基本不用】



输出

* document.write('content')
* console.log

输入：

* prompt【传入值默认为string



alert prompt优先输出



字面量 = 变量值？



JS 弱数据语言 类似python

声明时不需要确认变量类型



隐式转换：

* 除了加号的运算符，一旦有一个数字就可以将另一个将字符串转化为数字
* 加号前是string，或者是其他的字符串，+号默认是string拼接
* +如果当作正号用，那么就可以将字符串变成数字



typeof 值类型

显示转换：

* Number 数字
* parseInt 只按顺序保留第一组整数
* parseFloat 只按顺序保留第一组浮点数



渲染可变表格要将html放到document.write 之中



具名函数

用 function fn(){} 这个可以先使用后声明 

匿名函数-函数表达式：必须先声明后使用



建议用：

* let

* 能用const就多用const

* 数组对象等复杂的、以堆存储的const可以改变其**值**【注意不是改变地址】

  * ```
    const arr = [1,2]
    arr.push[3]
    ```

  * 这个是可以的

  * ```
    const arr = [1,2]
    arr =[1,2,3]
    ```

  * 这个改变了地址，是不对的





## DOM 和 BOM

通过JS去操作DOM和BOM



### DOM document Object MOdel

文档对象模型 —— 用来操作网页内容

* 开发内容特效和实现用户交互
* 

#### DOM树

* 将DOM对象以结构树的形式表示出来
* DOM对象【对应html的标签，《》之间的东西】
  * 浏览器根据html标签生成的js对象
    * 所有的标签属性都在对象上
    * 修改JS中对象的属性可以直接映射到对应的对象上
  * 核心思想是吧网页内容当作对象来处理
  * document对象就是DOM的一个对象，【document write的document】



### 获取DOM元素

#### 通过CSS选择器获取DOM元素

之前用css选择器

现在利用js选择页面选中标签元素

document.querySelector('对应的选择器')

* 选择子类 引号内 "父【空格】子"
* 选择子类同名第n个 引号内 "父【空格】子：nth-child"
* 返回所有： document.querySelectorAll('对应的选择器')

innerText

* 对象文字内容，不解析标签

innerHtml

* 解析标签

