---
transition: slide-up
---

<script setup>
const contents = [
  { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>.' },
  { text: '<b>Sample Input:</b> <code>123</code>' },
  { text: '<b>Expected Output:</b><br><code>Sum of digits = 6</code>' }
]

const testCases = [
  {
    id: 1,
    name: 'Sample 1',
    input: '123',
    expectedOutput: 'Sum of digits = 6',
    isHidden: false
  },
  {
    id: 2,
    name: 'Sample 2',
    input: '9',
    expectedOutput: 'Sum of digits = 9',
    isHidden: false
  },
  {
    id: 3,
    name: 'Hidden 1',
    input: '1000',
    expectedOutput: 'Sum of digits = 1',
    isHidden: true
  },
  {
    id: 4,
    name: 'Hidden 2',
    input: '0',
    expectedOutput: 'Sum of digits = 0',
    isHidden: true
  },
  {
    id: 5,
    name: 'Hidden 3',
    input: '987654',
    expectedOutput: 'Sum of digits = 39',
    isHidden: true
  },
  {
    id: 6,
    name: 'Hidden 4',
    input: '505',
    expectedOutput: 'Sum of digits = 10',
    isHidden: true
  }
]

const starterCode = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int num = sc.nextInt();
        int sum = 0;
        
        // Write your logic here to calculate sum of digits
        
        System.out.println("Sum of digits = " + sum);
    }
}`
</script>

<Slide
  question-slug="sum-of-digits"
  topic="Decision-making statements"
  sub-topic="Sum of Digits"
  language="java"
  :contents="contents"
  :test-cases="testCases"
  :starter-code="starterCode"
/>